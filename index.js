import 'dotenv/config'
import ms from 'ms'
import emailjs from '@emailjs/nodejs'
import { PrismaClient } from '@prisma/client'
import { CronJob } from 'cron'

const prisma = new PrismaClient()

emailjs.init({
	publicKey: process.env.EMAILJS_PUBLIC_KEY,
	privateKey: process.env.EMAILJS_PRIVATE_KEY,
})

new CronJob('0 0 18 * * *', main(), null, true, 'America/Chicago')

async function main() {
	console.log('Fetching newly published projects from Modrinth...')

	const today = new Date().valueOf()
	const url = `https://api.modrinth.com/v2/search?facets=[["created_timestamp>${Math.round((today - ms('1 day')) / 1000)}"]]&index=newest&limit=100`

	let hits = []
	const res = await fetch(url)
	const data = await res.json()
	hits = [...data.hits]

	const additionalCalls = Math.ceil(data.total_hits / 100) - 1

	for (let i = 0; i < additionalCalls; i++) {
		const res = await fetch(`${url}&offset=${i * 100}`)
		const data = await res.json()
		hits = [...data.hits]
	}

	const strings = []
	for (const hit of hits) {
		strings.push(`${hit.title}`)
	}

	const joinedStrings = strings.join('\n')
	const email = {
		date: new Date(today).toDateString(),
		data: joinedStrings,
	}

	emailjs.send(process.env.EMAILJS_SERVICE_ID, process.env.EMAILJS_TEMPLATE_ID, email)

	console.log('Fetching completed.')
}
