import { Endb } from './endb.js'

const db = new Endb()

console.log(db)

// En syntax jag skulle trivas med är:

const user = {
	name: "Testjohnny Mc'MathRandom",
	age: Math.random() * 100,
}

//await db.sql`insert into users ${user}`

// Det jag behöver göra nu är istället:

//await db.sql(insert into users ${JSON.stringify(user)})

// Ni skulle behöva köra stringify internt istället, och anpassa så .sql tar en templatesträng. Blir kanske knepigt, men det ser ut som att ni redan försöker stödja det caset men att det inte lirar riktigt?

//db.sql(`select * from ${table}`, { table: 'users' })

// Weird. Funkar:
var n = 'Michael'
//db.sql`INSERT INTO USERS (name) VALUES (${n})`

// Funkar inte:
//db.sql`insert into users ${JSON.stringify(user)};`

// Funkar:
db.sql`insert into users ${user}`

console.log(await db.sql`select * from users`)
