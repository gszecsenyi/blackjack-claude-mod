import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
const PANE = {
  component: 'Pane',
  requestId: 'blackjack',
  props: { title: 'Blackjack', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

test('the table deals and plays a hand', async ($, on) => {
  mock.store(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'blackjack', surface, ...PANE })
    expect(await ui.find({ key: 'deal' })).toBeDefined()
    await ui.press({ key: 'deal' })
    const stand = await ui.find({ key: 'stand' })
    if (stand) {
      await ui.press({ key: 'stand' })
    }
    expect(await ui.find({ key: 'deal' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Chips/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the offer shows once after the tool is called', async ($, on) => {
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text key="engine">engine band</Text>
  })
  const ui = await $.ui.mount({ plugin: 'blackjack', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'play' })).toBeUndefined()

  await $.tool.call({ tool: 'mcp__blackjack__offer_blackjack', reason: 'Big refactor' })
  expect(await ui.find({ key: 'play' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Big refactor/ })).toBeDefined()

  await ui.press({ key: 'no' })
  expect(await ui.find({ key: 'play' })).toBeUndefined()

  await $.tool.call({ tool: 'mcp__blackjack__offer_blackjack' })
  expect(await ui.find({ key: 'play' })).toBeUndefined()
  await ui.unmount()
})
