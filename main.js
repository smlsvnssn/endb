import './style.css'

console.log('Nothing to see here yet.')

const getNow = () => new Date(Date.now()).toISOString().slice(0, -5)

try {
    document.querySelector('.now').innerHTML = getNow()
} catch (error) {
    // It's alright
}
