import { describe, expect, test } from 'claude-code/testing'

import type { Card, Game } from '../types'
import { BET, deal, double, hit, newGame, settle, stand, value } from '../hooks/game'

const c = (rank: string): Card => ({ rank, suit: '♠' })
const table = (player: string[], dealer: string[], deck: string[] = []): Game => ({
  ...newGame(1000 - BET),
  phase: 'player',
  bet: BET,
  player: player.map(c),
  dealer: dealer.map(c),
  deck: deck.map(c),
})
const never = () => 0

describe('value', () => {
  test('counts aces as 11 or 1', async () => {
    expect(value(['A', 'K'].map(c))).toBe(21)
    expect(value(['A', 'A', '9'].map(c))).toBe(21)
    expect(value(['A', '9', '5'].map(c))).toBe(15)
    expect(value(['K', 'Q', '5'].map(c))).toBe(25)
  })
})

describe('rounds', () => {
  test('dealer draws below 17 and busts', async () => {
    const done = stand(table(['10', '8'], ['10', '2'], ['3', '9']), never)
    expect(done.dealer.length).toBe(4)
    expect(value(done.dealer)).toBe(24)
    expect(done.chips).toBe(1000 + BET)
  })

  test('dealer stands on 17 and player 18 wins double the bet', async () => {
    const done = stand(table(['10', '8'], ['10', '7']), never)
    expect(done.phase).toBe('done')
    expect(done.chips).toBe(1000 + BET)
  })

  test('bust loses the bet', async () => {
    const done = hit(table(['10', '8'], ['10', '7'], ['5']), never)
    expect(done.phase).toBe('done')
    expect(done.chips).toBe(1000 - BET)
  })

  test('blackjack pays 3:2', async () => {
    const done = settle(table(['A', 'K'], ['10', '7']))
    expect(done.chips).toBe(1000 + BET * 1.5)
  })

  test('push returns the bet', async () => {
    const done = stand(table(['10', '7'], ['10', '7']), never)
    expect(done.chips).toBe(1000)
  })

  test('double doubles the stake and takes one card', async () => {
    const done = double(table(['5', '6'], ['10', '7'], ['10']), never)
    expect(done.player.length).toBe(3)
    expect(done.bet).toBe(BET * 2)
    expect(done.chips).toBe(1000 + BET * 2)
  })

  test('deal takes the bet and refills an empty purse', async () => {
    const fresh = deal(newGame(1000), Math.random)
    expect(fresh.player.length).toBe(2)
    const broke = deal(newGame(0), Math.random)
    expect(broke.chips === 1000 - BET || broke.phase === 'done').toBe(true)
  })
})
