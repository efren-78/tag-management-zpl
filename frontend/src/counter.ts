/**
 * Configura el contador para un elemento HTML.
 * @param element Elemento HTML donde se mostrará el contador.
 */

export function setupCounter(element: HTMLButtonElement) {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `Count is ${counter}`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
}
