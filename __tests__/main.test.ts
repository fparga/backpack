import readability from '@mozilla/readability'
import {JSDOM} from 'jsdom'

test('test readability', () => {
  var doc = new JSDOM("<body>Here's a bunch of text</body>", {
    url: 'https://www.example.com/the-page-i-got-the-source-from'
  })

  // @ts-ignore
  let reader = new readability.Readability(doc.window.document)
  let article = reader.parse()

  expect(article).toStrictEqual({
    title: '',
    byline: null,
    dir: null,
    content: `<div id="readability-page-1" class="page">Here's a bunch of text</div>`,
    textContent: "Here's a bunch of text",
    length: 22,
    excerpt: undefined,
    siteName: null
  })
})
