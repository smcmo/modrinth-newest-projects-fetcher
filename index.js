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

	for (const project of hits) {
		await prisma.project.upsert({
			where: {
				id: project.project_id,
			},
			create: {
				id: project.project_id,
				title: project.title,
				iconUrl: project.icon_url,
				dateAdded: new Date(today),
				snapshots: {
					create: [
						{
							snapshotDate: new Date(today),
							downloads: project.downloads,
							follows: project.follows,
						},
					],
				},
			},
			update: {
				snapshots: {
					create: [
						{
							snapshotDate: new Date(today),
							downloads: project.downloads,
							follows: project.follows,
						},
					],
				},
			},
		})
	}

	const projects = await prisma.project.findMany({
		where: {
			dateAdded: {
				gt: new Date(today - 2629746000),
			},
		},
		include: {
			snapshots: true,
		},
	})

	const topProjects = []
	for (const project of projects) {
		project.snapshots.sort((a, b) => {
			a.snapshotDate.valueOf() - b.snapshotDate.valueOf()
		})

		if (project.snapshots.length <= 1) break

		const downloadsDiff = project.snapshots[0].downloads - project.snapshots[1].downloads
		const followsDiff = project.snapshots[0].follows - project.snapshots[1].follows
		topProjects.push({
			title: project.title,
			iconUrl: project.iconUrl,
			follows: project.snapshots[0].follows,
			followsDelta: followsDiff,
			downloads: project.snapshots[0].downloads,
			downloadsDelta: downloadsDiff,
		})
	}

	topProjects.sort((a, b) => {
		a.downloadsDelta - b.downloadsDelta
	})

	const email = {
		date: new Date(today).toDateString(),
		project1_title: topProjects[0].title,
		project1_downloads: topProjects[0].downloads,
		project1_follows: topProjects[0].follows,
		project1_downloadsDelta: topProjects[0].downloadsDelta,
		project1_followsDelta: topProjects[0].followsDelta,
		project2_title: topProjects[1].title,
		project2_downloads: topProjects[1].downloads,
		project2_follows: topProjects[1].follows,
		project2_downloadsDelta: topProjects[1].downloadsDelta,
		project2_followsDelta: topProjects[1].followsDelta,
		project3_title: topProjects[2].title,
		project3_downloads: topProjects[2].downloads,
		project3_follows: topProjects[2].follows,
		project3_downloadsDelta: topProjects[2].downloadsDelta,
		project3_followsDelta: topProjects[2].followsDelta,
		project4_title: topProjects[3].title,
		project4_downloads: topProjects[3].downloads,
		project4_follows: topProjects[3].follows,
		project4_downloadsDelta: topProjects[3].downloadsDelta,
		project4_followsDelta: topProjects[3].followsDelta,
		project5_title: topProjects[4].title,
		project5_downloads: topProjects[4].downloads,
		project5_follows: topProjects[4].follows,
		project5_downloadsDelta: topProjects[4].downloadsDelta,
		project5_followsDelta: topProjects[4].followsDelta,
	}

	emailjs.send(process.env.EMAILJS_SERVICE_ID, process.env.EMAILJS_TEMPLATE_ID, email)

	console.log('Fetching completed.')
}
