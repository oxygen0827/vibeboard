function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function addError(errors, category, message, details = {}) {
  errors.push({ category, message, ...details })
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
}

export function validateBoardSkills(board) {
  const errors = []
  const skills = Array.isArray(board?.skills) ? board.skills : []
  const contracts = Array.isArray(board?.driverContracts) ? board.driverContracts : []
  const skillIds = new Set()
  const contractIds = new Set()
  const contractsBySkill = new Map()

  if (!board?.id) {
    addError(errors, 'board-missing-id', 'board.id is required')
  }

  for (const [index, skill] of skills.entries()) {
    if (!isPlainObject(skill)) {
      addError(errors, 'skill-invalid', 'skill entry must be an object', { index })
      continue
    }
    if (!skill.id || typeof skill.id !== 'string') {
      addError(errors, 'skill-missing-id', 'skill.id is required', { index })
      continue
    }
    if (skillIds.has(skill.id)) {
      addError(errors, 'skill-duplicate-id', `duplicate skill id: ${skill.id}`, { skillId: skill.id })
    }
    skillIds.add(skill.id)

    if (!skill.label || typeof skill.label !== 'string') {
      addError(errors, 'skill-missing-label', `skill ${skill.id} must have label`, { skillId: skill.id })
    }
    if (!isPlainObject(skill.projectConfig)) {
      addError(errors, 'skill-missing-project-config', `skill ${skill.id} must have projectConfig`, {
        skillId: skill.id,
      })
    }
    if (!skill.systemPrompt || typeof skill.systemPrompt !== 'string') {
      addError(errors, 'skill-missing-system-prompt', `skill ${skill.id} must have systemPrompt`, {
        skillId: skill.id,
      })
    }
  }

  for (const [index, contract] of contracts.entries()) {
    if (!isPlainObject(contract)) {
      addError(errors, 'contract-invalid', 'driver contract entry must be an object', { index })
      continue
    }
    if (!contract.id || typeof contract.id !== 'string') {
      addError(errors, 'contract-missing-id', 'driver contract id is required', { index })
      continue
    }
    if (contractIds.has(contract.id)) {
      addError(errors, 'contract-duplicate-id', `duplicate driver contract id: ${contract.id}`, {
        driverContract: contract.id,
      })
    }
    contractIds.add(contract.id)

    if (!contract.skillId || typeof contract.skillId !== 'string') {
      addError(errors, 'contract-missing-skill', `driver contract ${contract.id} must have skillId`, {
        driverContract: contract.id,
      })
    } else if (!skillIds.has(contract.skillId)) {
      addError(errors, 'contract-unknown-skill', `driver contract ${contract.id} references unknown skill ${contract.skillId}`, {
        driverContract: contract.id,
        skillId: contract.skillId,
      })
    }

    if (!Array.isArray(contract.requiredInit)) {
      addError(errors, 'contract-missing-required-init', `driver contract ${contract.id} must list requiredInit`, {
        driverContract: contract.id,
      })
    }
    if (!Array.isArray(contract.allowedApis)) {
      addError(errors, 'contract-missing-allowed-apis', `driver contract ${contract.id} must list allowedApis`, {
        driverContract: contract.id,
      })
    }
    if (!Array.isArray(contract.forbiddenApis)) {
      addError(errors, 'contract-missing-forbidden-apis', `driver contract ${contract.id} must list forbiddenApis`, {
        driverContract: contract.id,
      })
    }
    if (!Array.isArray(contract.acceptanceChecks)) {
      addError(errors, 'contract-missing-acceptance-checks', `driver contract ${contract.id} must list acceptanceChecks`, {
        driverContract: contract.id,
      })
    }

    if (contract.skillId) {
      const existing = contractsBySkill.get(contract.skillId) || []
      existing.push(contract.id)
      contractsBySkill.set(contract.skillId, existing)
    }
  }

  for (const skill of skills) {
    if (!skill?.id) continue
    const driverContractIds = normalizeStringArray(skill.driverContractIds)
    const hasHardwareConfig = Boolean(skill.projectConfig) || Boolean(skill.systemPrompt)
    if (hasHardwareConfig && driverContractIds.length === 0) {
      addError(errors, 'skill-missing-driver-contracts', `skill ${skill.id} must declare driverContractIds`, {
        skillId: skill.id,
      })
    }

    const seenContractIds = new Set()
    for (const contractId of driverContractIds) {
      if (seenContractIds.has(contractId)) {
        addError(errors, 'skill-duplicate-driver-contract', `skill ${skill.id} repeats driver contract ${contractId}`, {
          skillId: skill.id,
          driverContract: contractId,
        })
      }
      seenContractIds.add(contractId)

      if (!contractIds.has(contractId)) {
        addError(errors, 'skill-unknown-driver-contract', `skill ${skill.id} references unknown driver contract ${contractId}`, {
          skillId: skill.id,
          driverContract: contractId,
        })
        continue
      }
      const contract = contracts.find(item => item.id === contractId)
      if (contract?.skillId !== skill.id) {
        addError(
          errors,
          'skill-contract-owner-mismatch',
          `skill ${skill.id} references driver contract ${contractId} owned by ${contract?.skillId}`,
          { skillId: skill.id, driverContract: contractId, ownerSkillId: contract?.skillId },
        )
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      boardId: board?.id || '',
      skillCount: skills.length,
      driverContractCount: contracts.length,
      contractsBySkill: Object.fromEntries(contractsBySkill),
    },
  }
}
