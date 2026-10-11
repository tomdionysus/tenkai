// A Jasmine reporter that writes each event as a line of JSON on stdout, for spec/browser/server.js to pass to
// the page as it happens.
const out = (event, data) => process.stdout.write(JSON.stringify({ event, ...data }) + '\n')

export default class LineReporter {
  jasmineStarted (info) { out('started', { total: info.totalSpecsDefined }) }
  suiteStarted (r) { out('suite', { id: r.id, name: r.description, full: r.fullName }) }
  specDone (r) {
    out('spec', {
      name: r.description,
      full: r.fullName,
      status: r.status,
      failures: r.failedExpectations.map((f) => f.message + '\n' + (f.stack || '').split('\n').slice(0, 4).join('\n'))
    })
  }

  jasmineDone (r) { out('done', { status: r.overallStatus }) }
}
