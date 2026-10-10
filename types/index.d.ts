export type Suit = '♠' | '♥' | '♦' | '♣'
export type Card = { rank: string; suit: Suit }
export type Phase = 'idle' | 'player' | 'done'

export type Game = {
  deck: Card[]
  player: Card[]
  dealer: Card[]
  phase: Phase
  bet: number
  chips: number
  message: string
}

declare module 'claude-code' {
  interface PluginState {
    blackjack: {
      game: Game | null
      isOfferShown: boolean
      wasOffered: boolean
      offerReason: string
    }
  }
}
