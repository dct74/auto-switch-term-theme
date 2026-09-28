import process from 'node:process';
import {consola} from 'consola';
import darkMode from 'dark-mode';
import sync from './sync.js';

const DEFAULT_RECONCILE_SECONDS = 60;

function reconcileIntervalMs() {
	const seconds = Number(process.env.AUTO_SWITCH_TERM_THEME_INTERVAL ?? DEFAULT_RECONCILE_SECONDS);

	return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RECONCILE_SECONDS) * 1000;
}

/**
Watch for appearance changes and keep the Terminal profile in sync.

Three layers, so a single missed event can't leave the profile stale:

1. An initial sync at startup, so login / reboot / service restart is correct
   even before any appearance change happens.
2. The live watcher, which reacts to `AppleInterfaceThemeChangedNotification`
   immediately.
3. A periodic reconcile, which catches changes whose notification was lost
   (most commonly: the Mac was asleep when the appearance changed).

Every step goes through `sync`, which swallows and logs errors, so the process
is not killed by a transient failure.

@returns {Promise<void>}
 */
export default async function watch() {
	// 1. Startup sync
	await sync({force: true});

	// 2. Live appearance changes
	try {
		darkMode.watch(isDarkMode => {
			sync({force: true, mode: isDarkMode ? 'dark' : 'light'}).catch(error => {
				consola.error(error);
			});
		});
	} catch (error) {
		consola.warn(`could not start the live appearance watcher: ${error.message}`);
	}

	// 3. Safety net for missed notifications
	const timer = setInterval(() => {
		sync().catch(error => {
			consola.error(error);
		});
	}, reconcileIntervalMs());

	return timer;
}
