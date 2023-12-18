import cors from 'cors'
import express, { ErrorRequestHandler, Response } from 'express'
import { print } from 'listening-on'
import { HttpError } from './http.error'
import httpStatus from 'http-status'

let app = express()

app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

type Task = {
  id: number
  keyword: string
  callback: (result: string) => void
}
let tasks: Task[] = []
let id = 0

app.get('/search', (req, res, next) => {
  let keyword = req.query.keyword
  console.log('search by keyword:', keyword)
  if (typeof keyword !== 'string') {
    next(new HttpError(400, 'expect req.query.keyword to be a string'))
    return
  }
  id++
  let task: Task = {
    id,
    keyword,
    callback: result => {
      console.log('task result:', result)
      res.json({ result })
      let index = tasks.indexOf(task)
      tasks.splice(index, 1)
    },
  }
  tasks.push(task)
  getTaskPollingQueue.shift()?.json({
    task: {
      id: task.id,
      keyword: task.keyword,
    },
  })
})

let getTaskPollingQueue: Response[] = []
let longPollingInterval = 1000 * 5

app.get('/task', (req, res, next) => {
  let task = tasks[0]
  if (task) {
    res.json({
      task: {
        id: task.id,
        keyword: task.keyword,
      },
    })
    return
  }
  getTaskPollingQueue.push(res)
  setTimeout(() => {
    let index = getTaskPollingQueue.indexOf(res)
    if (index == -1) return
    getTaskPollingQueue.splice(index, 1)
    res.redirect(httpStatus.TEMPORARY_REDIRECT, req.url)
  }, longPollingInterval)
})

app.post('/task/:id/result', (req, res, next) => {
  let id = +req.params.id
  console.log('task completed:', {
    id,
    result: req.body,
  })
  let task = tasks.find(task => task.id == id)
  if (!task) {
    next(new HttpError(404, 'task not found'))
    return
  }
  task.callback(req.body)
  res.json({})
})

app.use((req, res, next) =>
  next(
    new HttpError(
      404,
      `route not found, method: ${req.method}, url: ${req.url}`,
    ),
  ),
)

let errorHandler: ErrorRequestHandler = (err: HttpError, req, res, next) => {
  if (!err.statusCode) console.error(err)
  res.status(err.statusCode || 500)
  let error = String(err).replace(/^(\w*)Error: /, '')
  if (req.headers.accept?.includes('application/json')) {
    res.json({ error })
  } else {
    res.end(error)
  }
}
app.use(errorHandler)

let port = 8100
app.listen(port, () => {
  print(port)
})
