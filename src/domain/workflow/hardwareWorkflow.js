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

const DEFAULT_MAX_SOURCE_REPAIR_ATTEMPTS = 2
const DEFAULT_MAX_BUILD_REPAIR_ATTEMPTS = 2

async function callAdapter(adapters, name, ...args) {
  const fn = adapters?.[name]
  if (typeof fn !== 'function') throw new Error(`missing workflow adapter: ${name}`)
  return fn(...args)
}

async function repairSourceUntilValid({
  adapters,
  emit,
  input,
  manifest,
  selectedSkills,
  sourceCheck,
  sourceFiles,
  maxSourceRepairAttempts,
  sourceRepairAttempts,
  attemptContext = {},
}) {
  let currentCheck = sourceCheck
  let attempts = sourceRepairAttempts
  while (!currentCheck?.ok && typeof adapters.repairSource === 'function' && attempts < maxSourceRepairAttempts) {
    attempts += 1
    const diagnostics = currentCheck?.message || '源码契约未通过'
    emit(createWorkflowMessageEvent(
      `生成源码未通过设备/预览契约自检，正在自动修复第 ${attempts}/${maxSourceRepairAttempts} 轮...\n\n${diagnostics}`,
      { manifest },
    ))
    const repairResult = await callAdapter(adapters, 'repairSource', {
      ...input,
      ...attemptContext,
      selectedSkills,
      manifest,
      files: currentCheck?.files || sourceFiles || {},
      diagnostics,
      attempt: attempts,
    })
    if (!repairResult?.ok) throw new Error(repairResult?.message || '源码自动修复未通过校验')
    currentCheck = await callAdapter(adapters, 'validateSource', repairResult.files || {}, {
      ...input,
      ...attemptContext,
      selectedSkills,
      manifest,
      repairAttempt: attempts,
    })
  }
  return {
    sourceCheck: currentCheck,
    sourceRepairAttempts: attempts,
  }
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
    let sourceCheck = await callAdapter(adapters, 'validateSource', sourceResult.files || {}, {
      ...input,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
    })
    let sourceRepairAttempts = 0
    const maxSourceRepairAttempts = Number.isInteger(adapters.maxSourceRepairAttempts)
      ? adapters.maxSourceRepairAttempts
      : DEFAULT_MAX_SOURCE_REPAIR_ATTEMPTS
    ;({ sourceCheck, sourceRepairAttempts } = await repairSourceUntilValid({
      adapters,
      emit,
      input,
      manifest: manifestResult.manifest,
      selectedSkills: scopedSkills,
      sourceCheck,
      sourceFiles: sourceResult.files || {},
      maxSourceRepairAttempts,
      sourceRepairAttempts,
    }))
    if (!sourceCheck?.ok) throw new Error(sourceCheck?.message || '源码契约未通过')

    let currentFiles = sourceCheck.files || sourceResult.files || {}
    emit({
      type: HARDWARE_WORKFLOW_EVENT.SOURCE_READY,
      payload: { files: currentFiles },
    })

    const maxBuildRepairAttempts = Number.isInteger(adapters.maxBuildRepairAttempts)
      ? adapters.maxBuildRepairAttempts
      : DEFAULT_MAX_BUILD_REPAIR_ATTEMPTS
    let buildRepairAttempts = 0
    let compileResult = null
    while (!compileResult) {
      try {
        compileResult = await callAdapter(adapters, 'compile', {
          ...input,
          selectedSkills: scopedSkills,
          manifest: manifestResult.manifest,
          files: currentFiles,
        })
      } catch (error) {
        if (typeof adapters.repairBuild !== 'function' || buildRepairAttempts >= maxBuildRepairAttempts) {
          throw error
        }
        buildRepairAttempts += 1
        const errorMessage = error.message || String(error)
        emit(createWorkflowMessageEvent(
          `自动编译发现错误，正在让 AI 修复第 ${buildRepairAttempts}/${maxBuildRepairAttempts} 轮...\n\n${errorMessage}`,
          { manifest: manifestResult.manifest },
        ))
        const repairResult = await callAdapter(adapters, 'repairBuild', {
          ...input,
          selectedSkills: scopedSkills,
          manifest: manifestResult.manifest,
          files: currentFiles,
          error: errorMessage,
          buildEvidence: error.buildEvidence || null,
          attempt: buildRepairAttempts,
        })
        if (!repairResult?.ok) throw new Error(repairResult?.message || '编译自动修复补丁未通过校验')
        currentFiles = { ...currentFiles, ...(repairResult.files || {}) }
        sourceCheck = await callAdapter(adapters, 'validateSource', currentFiles, {
          ...input,
          selectedSkills: scopedSkills,
          manifest: manifestResult.manifest,
          buildRepairAttempt: buildRepairAttempts,
        })
        ;({ sourceCheck, sourceRepairAttempts } = await repairSourceUntilValid({
          adapters,
          emit,
          input,
          manifest: manifestResult.manifest,
          selectedSkills: scopedSkills,
          sourceCheck,
          sourceFiles: currentFiles,
          maxSourceRepairAttempts,
          sourceRepairAttempts,
          attemptContext: { buildRepairAttempt: buildRepairAttempts },
        }))
        if (!sourceCheck?.ok) throw new Error(sourceCheck?.message || '编译修复后源码契约仍未通过')
        currentFiles = sourceCheck.files || currentFiles
      }
    }
    emit({
      type: HARDWARE_WORKFLOW_EVENT.COMPILE_ARTIFACT_READY,
      payload: compileResult,
    })

    const completed = {
      type: HARDWARE_WORKFLOW_EVENT.COMPLETED,
      payload: {
        selectedSkills: scopedSkills,
        manifest: manifestResult.manifest,
        files: currentFiles,
        artifact: compileResult.firmware || compileResult.artifact || null,
        buildEvidence: compileResult.buildEvidence || null,
        sourceRepairAttempts,
        buildRepairAttempts,
      },
    }
    emit(completed)

    return {
      status: 'completed',
      failureCategory: null,
      selectedSkills: scopedSkills,
      manifest: manifestResult.manifest,
      files: currentFiles,
      artifact: compileResult.firmware || compileResult.artifact || null,
      buildEvidence: compileResult.buildEvidence || null,
      sourceRepairAttempts,
      buildRepairAttempts,
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
