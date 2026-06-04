import {
  HARDWARE_WORKFLOW_EVENT,
  createWorkflowFailureEvent,
  createWorkflowMessageEvent,
  createWorkflowStepEvent,
} from './hardwareWorkflowEvents'
import { WORKFLOW_STEP_STATUS } from './generationWorkflow'

function noop() {}

function defaultShouldDraftDesign(scopeResult, skillIds) {
  return Boolean(scopeResult?.designRequired || new Set(skillIds || []).has('lvgl'))
}

async function callAdapter(adapters, name, ...args) {
  const fn = adapters?.[name]
  if (typeof fn !== 'function') throw new Error(`missing workflow adapter: ${name}`)
  return fn(...args)
}

export async function runHardwareWorkflow(input = {}, adapters = {}) {
  const emit = typeof adapters.emit === 'function' ? adapters.emit : noop
  const userRequest = String(input.userRequest || '').trim()

  try {
    emit(createWorkflowStepEvent('intent', WORKFLOW_STEP_STATUS.ACTIVE, '解析用户需求和技能'))
    const inferredSkills = await callAdapter(adapters, 'resolveSkills', input)
    emit({
      type: HARDWARE_WORKFLOW_EVENT.SKILLS_RESOLVED,
      payload: { selectedSkills: inferredSkills },
    })

    emit(createWorkflowStepEvent('scope', WORKFLOW_STEP_STATUS.ACTIVE, '按当前板子外设/BSP/官方例程界定功能'))
    const scopeResult = await callAdapter(adapters, 'runScope', {
      ...input,
      userRequest,
      selectedSkills: inferredSkills,
    })

    if (scopeResult?.status === 'needs_clarification') {
      const blocked = {
        type: HARDWARE_WORKFLOW_EVENT.BLOCKED,
        payload: {
          reason: 'needs-clarification',
          questions: scopeResult.questions || [],
          summary: scopeResult.summary || '',
        },
      }
      emit(blocked)
      return {
        status: 'blocked',
        failureCategory: 'needs-clarification',
        selectedSkills: inferredSkills,
        nextAction: 'ask-user',
      }
    }

    const scopedSkills = scopeResult?.selectedSkillIds?.length
      ? scopeResult.selectedSkillIds
      : inferredSkills

    const shouldDraftDesign = typeof adapters.shouldDraftDesign === 'function'
      ? adapters.shouldDraftDesign
      : defaultShouldDraftDesign

    if (shouldDraftDesign(scopeResult, scopedSkills, input)) {
      emit(createWorkflowStepEvent('design', WORKFLOW_STEP_STATUS.ACTIVE, '生成 LVGL 第一屏设计草稿'))
      const design = await callAdapter(adapters, 'generateDesignDraft', {
        ...input,
        userRequest,
        selectedSkills: scopedSkills,
        scope: scopeResult,
      })
      if (!design?.ok) throw new Error(design?.message || 'LVGL 设计草稿未通过校验')
      emit({
        type: HARDWARE_WORKFLOW_EVENT.DESIGN_DRAFT_READY,
        payload: {
          files: design.files || {},
          selectedSkills: scopedSkills,
          scope: scopeResult,
        },
      })
      return {
        status: 'blocked',
        failureCategory: null,
        selectedSkills: scopedSkills,
        files: design.files || {},
        nextAction: 'approve-design',
      }
    }

    emit(createWorkflowStepEvent('manifest', WORKFLOW_STEP_STATUS.ACTIVE, '生成 Program Manifest'))
    const manifestResult = await callAdapter(adapters, 'generateManifest', {
      ...input,
      userRequest,
      selectedSkills: scopedSkills,
      scope: scopeResult,
    })
    if (!manifestResult?.ok) throw new Error(manifestResult?.message || '程序清单未通过校验')
    emit({
      type: HARDWARE_WORKFLOW_EVENT.MANIFEST_READY,
      payload: { manifest: manifestResult.manifest },
    })

    emit(createWorkflowStepEvent('generate-files', WORKFLOW_STEP_STATUS.ACTIVE, '生成应用源码'))
    const sourceResult = await callAdapter(adapters, 'generateSource', {
      ...input,
      userRequest,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
    })
    if (!sourceResult?.ok) throw new Error(sourceResult?.message || '生成结果未通过校验')

    emit(createWorkflowStepEvent('validate-source', WORKFLOW_STEP_STATUS.ACTIVE, '校验生成文件'))
    const sourceCheck = await callAdapter(adapters, 'validateSource', sourceResult.files || {}, {
      ...input,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
    })
    if (!sourceCheck?.ok) throw new Error(sourceCheck?.message || '源码契约未通过')

    emit({
      type: HARDWARE_WORKFLOW_EVENT.SOURCE_READY,
      payload: { files: sourceCheck.files || sourceResult.files || {} },
    })

    const compileResult = await callAdapter(adapters, 'compile', {
      ...input,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
      files: sourceCheck.files || sourceResult.files || {},
    })
    emit({
      type: HARDWARE_WORKFLOW_EVENT.COMPILE_ARTIFACT_READY,
      payload: compileResult,
    })

    const completed = {
      type: HARDWARE_WORKFLOW_EVENT.COMPLETED,
      payload: {
        selectedSkills: scopedSkills,
        manifest: manifestResult.manifest,
        files: sourceCheck.files || sourceResult.files || {},
        artifact: compileResult.firmware || compileResult.artifact || null,
        buildEvidence: compileResult.buildEvidence || null,
      },
    }
    emit(completed)

    return {
      status: 'completed',
      failureCategory: null,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
      files: sourceCheck.files || sourceResult.files || {},
      artifact: compileResult.firmware || compileResult.artifact || null,
      buildEvidence: compileResult.buildEvidence || null,
      nextAction: null,
    }
  } catch (error) {
    const failure = createWorkflowFailureEvent('workflow-failed', error.message || String(error))
    emit(createWorkflowMessageEvent(error.message || String(error), { error: true }))
    emit(failure)
    return {
      status: 'failed',
      failureCategory: 'workflow-failed',
      error: error.message || String(error),
      nextAction: 'repair-or-retry',
    }
  }
}
