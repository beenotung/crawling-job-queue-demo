import { chromium } from 'playwright'

let api_origin = 'http://localhost:8100'

type Task = {
  id: number
  keyword: string
}

async function getTask() {
  for (;;) {
    let res = await fetch(api_origin + '/task', {
      headers: {
        Accept: 'application/json',
      },
    })
    let json = await res.json()
    if (json.error) {
      throw new Error(json.error)
    }
    let task = json.task
    if (task) {
      return task as Task
    }
  }
}

async function main() {
  let browser = await chromium.launch({ headless: false })
  let page = await browser.newPage()

  async function searchByKeyword(keyword: string) {
    await page.goto('http://youtube.com')
    await page.fill('input#search', keyword)
    let p = page.waitForEvent('domcontentloaded')
    page.evaluate(() => {
      document.querySelector<HTMLFormElement>('form#search-form')!.submit()
    })
    await p

    for (;;) {
      let items = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a#video-title'),
          a => {
            return {
              title: a.title,
              href: a.href,
            }
          },
        )
      })
      if (items.length > 0) {
        return { items }
      }
    }
  }

  for (;;) {
    let task = await getTask()
    console.log('processing task:', task)

    let result = await searchByKeyword(task.keyword)

    let res = await fetch(api_origin + '/task/' + task.id + '/result', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    })
    let json = await res.json()
    if (json.error) {
      throw new Error(json.error)
    }
  }
}
main().catch(e => console.error(e))
