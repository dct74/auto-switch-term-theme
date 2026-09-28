import {suite, test} from 'node:test';

/**
@param {import('node:test').TestContext} t
*/
async function setup(t) {
	const macTerminal = {
		getTerminalDefaultProfile: t.mock.fn(),
		setTerminalProfile: t.mock.fn(),
	};
	t.mock.module('mac-terminal', {exports: macTerminal});

	const consola = {
		error: t.mock.fn(),
		info: t.mock.fn(),
	};
	t.mock.module('consola', {exports: {consola}});

	const config = {get: t.mock.fn(() => 'Profile')};
	const library = {
		getConfig: t.mock.fn(async () => config),
		getCurrentMode: t.mock.fn(async () => 'dark'),
	};
	t.mock.module('#library', {exports: library});

	const update = t.mock.fn(async () => {});
	t.mock.module('../source/cli/actions/update.js', {exports: {default: update}});

	// https://github.com/nodejs/node/issues/59163
	const {default: sync} = await import(`../source/cli/actions/sync.js?test=${t.name}`);

	return {
		sync, config, library, macTerminal, update, consola,
	};
}

suite('sync', () => {
	test('does nothing when the default profile already matches', async t => {
		const {sync, macTerminal, update} = await setup(t);

		macTerminal.getTerminalDefaultProfile.mock.mockImplementation(async () => 'Profile');

		t.assert.strictEqual(await sync(), true);
		t.assert.strictEqual(update.mock.callCount(), 0);
	});

	test('updates when the default profile has drifted', async t => {
		const {sync, macTerminal, update} = await setup(t);

		macTerminal.getTerminalDefaultProfile.mock.mockImplementation(async () => 'Other');

		t.assert.strictEqual(await sync(), true);
		t.assert.deepStrictEqual(update.mock.calls[0].arguments[0], {mode: 'dark'});
	});

	test('with force, updates without checking the current profile', async t => {
		const {sync, macTerminal, update} = await setup(t);

		await sync({force: true});

		t.assert.strictEqual(macTerminal.getTerminalDefaultProfile.mock.callCount(), 0);
		t.assert.strictEqual(update.mock.callCount(), 1);
	});

	test('uses the provided mode', async t => {
		const {sync, library, update} = await setup(t);

		await sync({force: true, mode: 'light'});

		t.assert.strictEqual(library.getCurrentMode.mock.callCount(), 0);
		t.assert.deepStrictEqual(update.mock.calls[0].arguments[0], {mode: 'light'});
	});

	test('never throws: logs and returns false on failure', async t => {
		const {sync, update, consola} = await setup(t);

		update.mock.mockImplementation(async () => {
			throw new Error('Not authorized to send Apple events');
		});

		t.assert.strictEqual(await sync({force: true}), false);
		t.assert.match(consola.error.mock.calls[0].arguments[0], /Not authorized/v);
		t.assert.strictEqual(consola.info.mock.callCount(), 1);
	});
});
