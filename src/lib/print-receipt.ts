const PX_PER_MM = 96 / 25.4
// breathing room below the last line, as a till leaves before it cuts
const TAIL_MM = 4

/**
 * Prints the receipt on its own, on a page cut to its exact length: an 80mm till roll, one page,
 * however many items the order has. The rest of the screen is left out of the print entirely.
 */
export async function printReceipt(receipt: HTMLElement) {
  const roll = document.createElement('div')
  roll.id = 'receipt-print'
  roll.appendChild(receipt.cloneNode(true))
  document.body.appendChild(roll)
  // the copied logo has to finish decoding, or the print goes out without it
  await Promise.all([...roll.querySelectorAll('img')].map(image => image.decode().catch(() => undefined)))

  const lengthMm = Math.ceil(roll.getBoundingClientRect().height / PX_PER_MM) + TAIL_MM
  const page = document.createElement('style')
  page.textContent = `@page { size: 80mm ${lengthMm}mm; margin: 0; }`
  document.head.appendChild(page)

  const tidy = () => {
    roll.remove()
    page.remove()
    window.removeEventListener('afterprint', tidy)
  }
  window.addEventListener('afterprint', tidy)
  window.print()
}
