import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  createSkillQuery,
} from '../../../../src/domain/skill/skill-query.js'
import { InvalidSkillQueryError } from '../../../../src/domain/skill/errors.js'

describe('createSkillQuery', () => {
  it('keeps the task as the primary signal, normalized', () => {
    const query = createSkillQuery({ task: '  Create an Angular   Component  ' })

    expect(query.task).toBe('create an angular component')
  })

  it('defaults every optional field', () => {
    const query = createSkillQuery({ task: 'anything' })

    expect(query).toEqual({
      task: 'anything',
      phase: null,
      stack: [],
      files: [],
      keywords: [],
      limit: DEFAULT_SEARCH_LIMIT,
    })
  })

  it('normalizes, de-duplicates and sorts the stack', () => {
    const query = createSkillQuery({ task: 'x', stack: ['Angular', ' angular', 'TypeScript'] })

    expect(query.stack).toEqual(['angular', 'typescript'])
  })

  it('normalizes, de-duplicates and sorts the keywords', () => {
    const query = createSkillQuery({ task: 'x', keywords: ['Testing', 'testing', 'component'] })

    expect(query.keywords).toEqual(['component', 'testing'])
  })

  it('preserves the case of file paths, which are matched against patterns', () => {
    const query = createSkillQuery({ task: 'x', files: ['src/app/Users.component.ts'] })

    expect(query.files).toEqual(['src/app/Users.component.ts'])
  })

  it('de-duplicates files without altering them', () => {
    const query = createSkillQuery({ task: 'x', files: ['b.ts', 'a.ts', 'b.ts'] })

    expect(query.files).toEqual(['a.ts', 'b.ts'])
  })

  it('carries the requested phase', () => {
    expect(createSkillQuery({ task: 'x', phase: 'implementation' }).phase).toBe('implementation')
  })

  it('produces identical queries for inputs differing only in case or order', () => {
    const first = createSkillQuery({ task: 'Build IT', stack: ['Angular', 'rxjs'] })
    const second = createSkillQuery({ task: 'build it', stack: ['RxJS', 'angular'] })

    expect(first).toEqual(second)
  })
})

describe('createSkillQuery limits', () => {
  it('uses the default limit when none is requested', () => {
    expect(createSkillQuery({ task: 'x' }).limit).toBe(DEFAULT_SEARCH_LIMIT)
  })

  it('honours a requested limit within range', () => {
    expect(createSkillQuery({ task: 'x', limit: 3 }).limit).toBe(3)
  })

  it('caps a limit above the maximum instead of failing', () => {
    expect(createSkillQuery({ task: 'x', limit: MAX_SEARCH_LIMIT + 50 }).limit).toBe(
      MAX_SEARCH_LIMIT,
    )
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 2.5],
  ])('rejects a %s limit', (_label, limit) => {
    expect(() => createSkillQuery({ task: 'x', limit })).toThrow(InvalidSkillQueryError)
  })
})

describe('createSkillQuery validation', () => {
  it.each([
    ['empty', ''],
    ['blank', '   '],
  ])('rejects a %s task', (_label, task) => {
    expect(() => createSkillQuery({ task })).toThrow(InvalidSkillQueryError)
  })

  it('rejects a task beyond the size limit', () => {
    expect(() => createSkillQuery({ task: 'a'.repeat(4097) })).toThrow(InvalidSkillQueryError)
  })

  it.each([
    ['stack', 'stack'],
    ['files', 'files'],
    ['keywords', 'keywords'],
  ])('rejects more than 64 %s entries', (_label, field) => {
    const values = Array.from({ length: 65 }, (_unused, index) => `value-${String(index)}`)

    expect(() => createSkillQuery({ task: 'x', [field]: values })).toThrow(InvalidSkillQueryError)
  })

  it('rejects a single entry beyond the term limit', () => {
    expect(() => createSkillQuery({ task: 'x', stack: ['a'.repeat(257)] })).toThrow(
      InvalidSkillQueryError,
    )
  })

  it('drops entries that normalize to an empty string', () => {
    expect(createSkillQuery({ task: 'x', stack: ['angular', '  ', ''] }).stack).toEqual(['angular'])
  })
})
