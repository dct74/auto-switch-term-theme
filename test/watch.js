import {suite, test} from 'node:test';

/**
@param {import('node:test').TestContext} t
*/
async function setup(t) {
	const darkMode = {watch: t.mock.fn()};
	t.mock.module('dark-mode', {exports: {default: darkMode}});

	const consola = {
		error: t.mock.fn(),
		info: t.mock.fn(),
		warn: t.mock.fn(),
	};
	t.mock.module('consola', {exports: {consola}});

	const sync = t.mock.fn(async () => true);
	t.mock.module('../source/cli/actions/sync.js', {exports: {default: sync}});

	// https://github.com/nodejs/node/issues/59163
	const {default: watch} = await import(`../source/cli/actions/watch.js?test=${t.name}`);

	return {
		watch,
		darkMode,
		sync,
		consola,
	};
}

suite('watch', () => {
	test('syncs immediately at startup', async t => {
		const {watch, sync} = await setup(t);

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		t.assert.deepStrictEqual(sync.mock.calls[0].arguments[0], {force: true});
	});

	test('watches for appearance changes', async t => {
		const {watch, darkMode} = await setup(t);

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		t.assert.strictEqual(darkMode.watch.mock.callCount(), 1);
	});

	test('syncs when dark mode is enabled', async t => {
		const {watch, darkMode, sync} = await setup(t);

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		const [onModeChange] = darkMode.watch.mock.calls[0].arguments;
		onModeChange(true);
		await new Promise(resolve => {
			setImmediate(resolve);
		});

		t.assert.deepStrictEqual(
			sync.mock.calls.at(-1).arguments[0],
			{force: true, mode: 'dark'},
		);
	});

	test('syncs when dark mode is disabled', async t => {
		const {watch, darkMode, sync} = await setup(t);

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		const [onModeChange] = darkMode.watch.mock.calls[0].arguments;
		onModeChange(false);
		await new Promise(resolve => {
			setImmediate(resolve);
		});

		t.assert.deepStrictEqual(
			sync.mock.calls.at(-1).arguments[0],
			{force: true, mode: 'light'},
		);
	});

	test('reconciles periodically as a safety net', async t => {
		t.mock.timers.enable({apis: ['setInterval']});

		const {watch, sync} = await setup(t);

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		const before = sync.mock.callCount();
		t.mock.timers.tick(60_000);
		await new Promise(resolve => {
			setImmediate(resolve);
		});

		t.assert.ok(sync.mock.callCount() > before);
		// The periodic reconcile is not forced, so it only acts on real drift.
		t.assert.strictEqual(sync.mock.calls.at(-1).arguments[0], undefined);
	});

	test('keeps running when the live watcher cannot start', async t => {
		const {watch, darkMode, consola} = await setup(t);

		darkMode.watch.mock.mockImplementation(() => {
			throw new Error('osascript unavailable');
		});

		const timer = await watch();
		t.after(() => {
			clearInterval(timer);
		});

		t.assert.match(consola.warn.mock.calls[0].arguments[0], /osascript unavailable/v);
	});
});
