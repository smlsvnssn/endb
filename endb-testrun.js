import { Endb } from './endb.js'

const db = new Endb()

console.log(db)

const user = {
    name: 'Testjohnny McMathRandom ' + Math.random(),
    age: Math.random() * 100,
}

console.log(JSON.stringify(user))

await db.sql(`insert into users ${JSON.stringify(user)}`)

console.log(await db.sql('select * from users'))
