// Standalone verification for scripts/forbid-focused-tests.cjs.
//
// Uses Node's built-in `node:test` runner so no test framework or dependency
// is added. Run with:
//   node --test scripts/forbid-focused-tests.test.cjs
//
// Guards the regex against regressions in both directions: it must catch
// `fit(`/`fdescribe(` (and `.each` variants) and must NOT flag ordinary words
// that merely contain the substring "fit" (profit, benefit, outfit, refit,
// fits) or the unfocused `it(`/`test(`/`describe(` calls.
const { test } = require('node:test')
const assert = require('node:assert/strict')

const { hasFocusedTest } = require('./forbid-focused-tests.cjs')

test('catches .only focused calls', () => {
  assert.equal(hasFocusedTest('it.only("x", () => {})'), true)
  assert.equal(hasFocusedTest('test.only("x", () => {})'), true)
  assert.equal(hasFocusedTest('describe.only("x", () => {})'), true)
  assert.equal(hasFocusedTest('it.only.each(["a"], () => {})'), true)
  assert.equal(hasFocusedTest('describe.only.each([...], () => {})'), true)
})

test('catches fit( and fdescribe( aliases', () => {
  assert.equal(hasFocusedTest('fit("x", () => {})'), true)
  assert.equal(hasFocusedTest('fdescribe("x", () => {})'), true)
  assert.equal(hasFocusedTest('fit.each(["a"], () => {})'), true)
  assert.equal(hasFocusedTest('fdescribe.each([...], () => {})'), true)
  assert.equal(hasFocusedTest('fit ("x", () => {})'), true)
  assert.equal(hasFocusedTest('fdescribe ("x", () => {})'), true)
})

test('does not flag ordinary words containing "fit"', () => {
  assert.equal(hasFocusedTest('const total = profit + 1'), false)
  assert.equal(hasFocusedTest('describe the benefit of using'), false)
  assert.equal(hasFocusedTest('an outfit that fits well'), false)
  assert.equal(hasFocusedTest('refit the component'), false)
  assert.equal(hasFocusedTest('it fits the requirement'), false)
  // Words with a trailing paren but no word boundary before "fit".
  assert.equal(hasFocusedTest('outfit('), false)
  assert.equal(hasFocusedTest('benefit('), false)
  assert.equal(hasFocusedTest('refit('), false)
})

test('does not flag regular (non-focused) calls', () => {
  assert.equal(hasFocusedTest('it("x", () => {})'), false)
  assert.equal(hasFocusedTest('test("x", () => {})'), false)
  assert.equal(hasFocusedTest('describe("x", () => {})'), false)
  assert.equal(hasFocusedTest('it.each(["a"], () => {})'), false)
  assert.equal(hasFocusedTest('describe.each([...], () => {})'), false)
})

test('does not flag "describe" inside ordinary prose', () => {
  assert.equal(hasFocusedTest('a description of the test'), false)
  assert.equal(hasFocusedTest('this describes the behavior'), false)
})
