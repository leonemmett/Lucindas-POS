export function paymentLabel(payment: string, card1Label: string, card2Label: string): string {
  switch (payment) {
    case 'cash':
      return 'Cash'
    case 'card1':
      return card1Label
    case 'card2':
      return card2Label
    case 'transfer':
      return 'Transfer'
    default:
      return payment
  }
}
