import type { Card, Game, Suit } from '../types'

export const START_CHIPS = 1000
export const BET = 50

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const DECKS = 4
const RESHUFFLE_BELOW = 20

export type Random = () => number

export const cryptoRandom: Random = () => {
  const one = new Uint32Array(1)
  crypto.getRandomValues(one)

  return (one[0] ?? 0) / 2 ** 32
}

export function shoe(random: Random): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit })
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = cards[i] as Card
    cards[i] = cards[j] as Card
    cards[j] = a
  }

  return cards
}

export function value(hand: readonly Card[]): number {
  let total = 0
  let aces = 0
  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1
      total += 11
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      total += 10
    } else {
      total += Number(card.rank)
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

export const isBlackjack = (hand: readonly Card[]) => hand.length === 2 && value(hand) === 21

export const label = (card: Card) => `${card.rank}${card.suit}`

export function newGame(chips: number): Game {
  return { deck: [], player: [], dealer: [], phase: 'idle', bet: 0, chips, message: '' }
}

function draw(deck: Card[], random: Random): { card: Card; deck: Card[] } {
  const from = deck.length > 0 ? deck : shoe(random)
  const [card, ...rest] = from

  return { card: card as Card, deck: rest }
}

export function deal(game: Game, random: Random): Game {
  const chips = game.chips < BET ? START_CHIPS : game.chips
  let deck = game.deck.length < RESHUFFLE_BELOW ? shoe(random) : game.deck
  const take = () => {
    const drawn = draw(deck, random)
    deck = drawn.deck

    return drawn.card
  }
  const player = [take()]
  const dealer = [take()]
  player.push(take())
  dealer.push(take())

  const next: Game = {
    deck,
    player,
    dealer,
    phase: 'player',
    bet: BET,
    chips: chips - BET,
    message: game.chips < BET ? 'Out of chips – here are 1000 more.' : '',
  }

  return isBlackjack(player) || isBlackjack(dealer) ? settle(next) : next
}

export function hit(game: Game, random: Random): Game {
  if (game.phase !== 'player') {
    return game
  }
  const { card, deck } = draw(game.deck, random)
  const next = { ...game, deck, player: [...game.player, card] }

  return value(next.player) >= 21 ? stand(next, random) : next
}

export const canDouble = (game: Game) =>
  game.phase === 'player' && game.player.length === 2 && game.chips >= game.bet

export function double(game: Game, random: Random): Game {
  if (!canDouble(game)) {
    return game
  }
  const { card, deck } = draw(game.deck, random)

  return stand(
    { ...game, deck, player: [...game.player, card], chips: game.chips - game.bet, bet: game.bet * 2 },
    random,
  )
}

export function stand(game: Game, random: Random): Game {
  if (game.phase !== 'player') {
    return game
  }
  if (value(game.player) > 21) {
    return settle(game)
  }
  let deck = game.deck
  const dealer = [...game.dealer]
  while (value(dealer) < 17) {
    const drawn = draw(deck, random)
    deck = drawn.deck
    dealer.push(drawn.card)
  }

  return settle({ ...game, deck, dealer })
}

export function settle(game: Game): Game {
  const you = value(game.player)
  const house = value(game.dealer)
  const done = (won: number, message: string): Game => ({
    ...game,
    phase: 'done',
    chips: game.chips + won,
    message,
  })

  if (isBlackjack(game.player) && isBlackjack(game.dealer)) return done(game.bet, 'Both have blackjack – push.')
  if (isBlackjack(game.player)) return done(game.bet + Math.floor(game.bet * 1.5), `Blackjack! +${Math.floor(game.bet * 1.5)}`)
  if (isBlackjack(game.dealer)) return done(0, `Dealer has blackjack. −${game.bet}`)
  if (you > 21) return done(0, `Bust (${you}). −${game.bet}`)
  if (house > 21) return done(game.bet * 2, `Dealer busts (${house}). +${game.bet}`)
  if (you > house) return done(game.bet * 2, `You win, ${you} vs ${house}. +${game.bet}`)
  if (you < house) return done(0, `Dealer wins, ${house} vs ${you}. −${game.bet}`)

  return done(game.bet, `Push, ${you}.`)
}
