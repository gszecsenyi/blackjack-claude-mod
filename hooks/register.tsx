import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Card, Game } from '../types'
import {
  START_CHIPS,
  canDouble,
  cryptoRandom,
  deal,
  double,
  hit,
  label,
  newGame,
  stand,
  value,
} from './game'

const PANE = 'blackjack'
const TOOL = 'offer_blackjack'

const game = atom({ plugin: 'blackjack', key: 'game' } as const, null)
const isOfferShown = atom({ plugin: 'blackjack', key: 'isOfferShown' } as const, false)
const wasOffered = atom({ plugin: 'blackjack', key: 'wasOffered' } as const, false)
const offerReason = atom({ plugin: 'blackjack', key: 'offerReason' } as const, '')

const DESCRIPTION = [
  'Offers the user a hand of blackjack in a side pane while you keep working.',
  'Call it ONCE, right as you start a task you expect to take several minutes',
  '(many files to change, a long build or test run, a broad refactor or investigation).',
  'Do not call it for short tasks or quick questions. It returns immediately; carry on with the task.',
].join(' ')

async function loadChips($: EngineInterface): Promise<number> {
  const stored = await $.store.get('chips')

  return typeof stored === 'number' && stored > 0 ? stored : START_CHIPS
}

async function play($: EngineInterface, move: (g: Game) => Game) {
  const chips = await loadChips($)
  const after = await update($, game, g => move(g ?? newGame(chips)))
  await $.store.set('chips', after.chips)
}

const openTable = ($: EngineInterface) =>
  $.ui.open({ id: PANE, title: 'Blackjack', focus: true, closeOnEscape: true, rows: 9 })

const hand = (cards: readonly Card[], isHidden = false) =>
  cards.map((card, i) => (isHidden && i === 1 ? '🂠' : label(card))).join('  ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL,
      description: DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'A few words on why this will take a while' },
        },
      },
    })
    await $.command.register({
      name: 'blackjack',
      description: 'Open the blackjack table',
      immediate: true,
    })

    return next(e)
  })

  on('tool.call', { tool: 'mcp__blackjack__offer_blackjack' }, async ($, e) => {
    if ((await $.store.get('optOut')) === true) {
      return { result: 'The user turned blackjack offers off. Carry on with the task.' }
    }
    if (await read($, wasOffered)) {
      return { result: 'Already offered this session. Carry on with the task.' }
    }
    const reason = (e as { reason?: unknown }).reason
    await update($, offerReason, () => (typeof reason === 'string' ? reason.slice(0, 80) : ''))
    await update($, wasOffered, () => true)
    await update($, isOfferShown, () => true)

    return { result: 'Offered. Carry on with the task; do not mention the game.' }
  })

  on('command.run', { command: 'blackjack' }, async $ => {
    await update($, isOfferShown, () => false)
    await openTable($)

    return { text: 'Blackjack table open (Esc returns to the prompt).' }
  })

  on('turn.complete', async ($, e, next) => {
    await update($, isOfferShown, () => false)
    const isPlaying = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isPlaying) {
      $.ui.toast('Claude is done – your game will wait.', { timeoutMs: 6000 })
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isOfferShown))) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const reason = await read($, offerReason)
    const hide = () => update($, isOfferShown, () => false)

    return (
      <Box gap={1}>
        <Text>
          🃏 {reason ? `${reason} – this` : 'This'} will take a while. Fancy a hand of blackjack?
        </Text>
        <Button
          key="play"
          label="Play"
          variant="primary"
          onPress={async () => {
            await hide()
            await openTable($)
          }}
        />
        <Button key="no" label="No thanks" onPress={hide} />
        <Button
          key="never"
          label="Don't ask again"
          dimColor
          onPress={async () => {
            await $.store.set('optOut', true)
            await hide()
          }}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const g = (await read($, game)) ?? newGame(await loadChips($))
    const isLive = g.phase === 'player'
    const random = cryptoRandom

    return (
      <Box flexDirection="column">
        {g.phase === 'idle' ? (
          <Text dimColor>Press Deal (n) to start. Bet: 50.</Text>
        ) : (
          <Box flexDirection="column">
            <Text>
              Dealer: {hand(g.dealer, isLive)}
              <Text dimColor> {isLive ? '' : `(${value(g.dealer)})`}</Text>
            </Text>
            <Text>
              You:    {hand(g.player)}
              <Text dimColor> ({value(g.player)})</Text>
            </Text>
          </Box>
        )}
        <Text bold={g.phase === 'done'}>{g.message || ' '}</Text>
        <Text dimColor>
          Chips: {g.chips}
          {isLive ? `   Bet: ${g.bet}` : ''}
        </Text>
        <Box gap={1}>
          {isLive ? (
            <Box gap={1}>
              <Button key="hit" label="Hit" hotkey="h" variant="primary" autoFocus onPress={() => play($, s => hit(s, random))} />
              <Button key="stand" label="Stand" hotkey="s" onPress={() => play($, s => stand(s, random))} />
              {canDouble(g) && (
                <Button key="double" label="Double" hotkey="d" onPress={() => play($, s => double(s, random))} />
              )}
            </Box>
          ) : (
            <Button key="deal" label="Deal" hotkey="n" variant="primary" autoFocus onPress={() => play($, s => deal(s, random))} />
          )}
          <Button key="close" label="Close" role="dismiss" dimColor onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
