import './style.css'

const getNow = () => new Date(Date.now()).toISOString().slice(0, -5)

const toggleCase = isUpperCase =>
    document
        .querySelectorAll('.st')
        .forEach(
            el =>
                (el.innerHTML = isUpperCase
                    ? el.innerHTML.toUpperCase()
                    : el.innerHTML.toLowerCase()),
        )

try {
    document.querySelector('.now').innerHTML = getNow()
} catch (error) {
    // It's alright
}

addEventListener('change', e => toggleCase(e.target.checked))
