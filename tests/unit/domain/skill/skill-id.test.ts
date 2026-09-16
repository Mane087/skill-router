import {
  createSkillId,
  formatSkillId,
  parseSkillId,
  skillIdEquals,
} from '../../../../src/domain/skill/skill-id.js'
import { InvalidSkillIdError } from '../../../../src/domain/skill/errors.js'

const NUL = String.fromCharCode(0)

describe('createSkillId', () => {
  it('builds an identifier from a scope and a name', () => {
    const id = createSkillId('global', 'angular')

    expect(id).toEqual({ scope: 'global', name: 'angular' })
  })

  it('accepts kebab-case names', () => {
    expect(createSkillId('project', 'architecture-planning').name).toBe('architecture-planning')
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['uppercase', 'Angular'],
    ['spaces', 'angular router'],
    ['path separator', 'angular/router'],
    ['windows separator', 'angular\\router'],
    ['parent traversal', '..'],
    ['dot segment', '.'],
    ['leading dash', '-angular'],
    ['trailing dash', 'angular-'],
    ['double dash', 'angular--router'],
    ['underscore', 'angular_router'],
    ['null byte', `angular${NUL}`],
    ['scope separator', 'global:angular'],
  ])('rejects a %s name', (_label, name) => {
    expect(() => createSkillId('global', name)).toThrow(InvalidSkillIdError)
  })

  it('rejects a name longer than 64 characters', () => {
    expect(() => createSkillId('global', 'a'.repeat(65))).toThrow(InvalidSkillIdError)
  })

  it('accepts a name of exactly 64 characters', () => {
    expect(createSkillId('global', 'a'.repeat(64)).name).toHaveLength(64)
  })
})

describe('formatSkillId', () => {
  it('renders the scope-qualified form used in results', () => {
    expect(formatSkillId(createSkillId('global', 'angular'))).toBe('global:angular')
    expect(formatSkillId(createSkillId('project', 'angular'))).toBe('project:angular')
  })
})

describe('parseSkillId', () => {
  it('round-trips a formatted identifier', () => {
    expect(parseSkillId('project:jest')).toEqual({ scope: 'project', name: 'jest' })
  })

  it.each([
    ['missing separator', 'angular'],
    ['unknown scope', 'remote:angular'],
    ['empty scope', ':angular'],
    ['empty name', 'global:'],
    ['extra separator', 'global:angular:extra'],
  ])('rejects %s', (_label, value) => {
    expect(() => parseSkillId(value)).toThrow(InvalidSkillIdError)
  })
})

describe('skillIdEquals', () => {
  it('keeps global and project skills of the same name distinct', () => {
    const globalSkill = createSkillId('global', 'angular')
    const projectSkill = createSkillId('project', 'angular')

    expect(skillIdEquals(globalSkill, projectSkill)).toBe(false)
  })

  it('matches identifiers with the same scope and name', () => {
    expect(skillIdEquals(createSkillId('global', 'angular'), parseSkillId('global:angular'))).toBe(
      true,
    )
  })
})
