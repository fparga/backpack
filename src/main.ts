import {JSDOM} from 'jsdom'
import * as core from '@actions/core'
import github from '@actions/github'
import readability, {ParseResult} from '@mozilla/readability'
import sanitize from 'sanitize-filename'
import TurndownService from 'turndown'

const turndownService = new TurndownService()

async function run(): Promise<void> {
  try {
    const url = core.getInput('url')
    const token = core.getInput('github-token')

    core.info('Retrieving DOM from url...')
    const dom = await JSDOM.fromURL(url)

    core.info('Extracting article from document...')
    const {content, excerpt, title} = extractArticle(dom.window.document)

    core.info('Converting Article to Markdown...')
    const markdownContent = htmlToMarkdown(content)
    const markdownExcerpt = htmlToMarkdown(excerpt)
    const markdownTitle = htmlToMarkdown(title)

    const sanitizedTitle = sanitize(markdownTitle)

    await openPR(token, {
      path: `${sanitizedTitle}.md`,
      content: createArticle({
        title: markdownTitle,
        content: markdownContent,
        url
      }),
      branch: `article/${sanitizedTitle}`,
      commitMsg: `article: ${markdownTitle}`,
      prTitle: markdownTitle,
      // TODO: better body
      prBody: markdownExcerpt,
      prLabels: ['article']
    })

    // TODO: add label
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

function toBase64(s: string): string {
  return Buffer.from(s).toString('base64')
}

function extractArticle(document: Document): ParseResult {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore looks like there is an issue with @types definitions
  const reader = new readability.Readability(document)
  const parseResult = reader.parse()

  core.startGroup('Article content:')
  core.debug(parseResult.content)
  core.endGroup()

  return parseResult
}

function htmlToMarkdown(html: string): string {
  const markdown = turndownService.turndown(html)

  core.startGroup('Markdown:')
  core.debug(markdown)
  core.endGroup()

  return markdown
}

function createArticle({
  title,
  url,
  content
}: {
  title: string
  url: string
  content: string
}): string {
  return `# ${title}

| Original URL | Saved on |
| --- | --- |
| ${url} | ${new Date().toISOString()} |

${content} 
`
}

async function openPR(
  token: string,
  {
    content,
    path,
    branch,
    commitMsg,
    prTitle,
    prBody,
    prLabels = []
  }: {
    content: string
    path: string
    branch: string
    commitMsg: string
    prTitle: string
    prBody: string
    prLabels: string[]
  }
): Promise<void> {
  const octokit = github.getOctokit(token)
  const {repo, sha} = github.context

  core.info(`Creating branch 'refs/heads/${branch}'...`)
  await octokit.git.createRef({
    ...repo,
    sha,
    ref: `refs/heads/${branch}`
  })

  core.info(`Pushing article to branch 'refs/heads/${branch}'...`)
  await octokit.repos.createOrUpdateFileContents({
    ...repo,
    branch,
    path,
    message: commitMsg,
    content: toBase64(content)
  })

  core.info(`Opening PR from 'refs/heads/${branch}' to 'master'...`)
  const pr = await octokit.pulls.create({
    ...repo,
    title: prTitle,
    body: prBody,
    head: branch,
    base: 'master'
  })

  octokit.issues.addLabels({
    ...repo,
    issue_number: pr.data.id,
    labels: prLabels
  })
}
