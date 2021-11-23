// See https://decembersoft.com/posts/promises-in-serial-with-array-reduce/

export function promiseChain(tasks) {
    return tasks.reduce((promiseChain, currentTask) => {
        return promiseChain.then(chainResults =>
            currentTask().then(currentResult =>
                [...chainResults, currentResult]
            )
        )
    }, Promise.resolve([]))
}
