import {consola} from 'consola';
import {getTerminalDefaultProfile} from 'mac-terminal';
import update from './update.js';
import {getConfig, getCurrentMode} from '#library';

/**
Switch the Terminal profile to match the current appearance mode.

Unlike `update`, this action never throws: every failure is logged so that a
transient problem (macOS Automation denied, a profile that no longer exists,
Terminal being closed, …) cannot kill the long-running `watch` process.

@param {object} [parameters] - Options
@param {boolean} [parameters.force] - Apply even when the default profile already matches
@param {'dark' | 'light'} [parameters.mode] - Appearance mode. Defaults to the current mode
@returns {Promise<boolean>} Whether the profile was (or already was) correct
 */
export default async function sync({force = false, mode} = {}) {
	try {
		mode ??= await getCurrentMode();

		if (!force) {
			const config = await getConfig();
			const desiredProfile = config.get(`profiles.${mode}`);
			const currentProfile = await getTerminalDefaultProfile();

			if (desiredProfile === currentProfile) {
				// Already correct: leave any per-tab profiles the user chose alone.
				return true;
			}
		}

		await update({mode});
		return true;
	} catch (error) {
		consola.error(`failed to switch the Terminal profile: ${error.message}`);
		consola.info(
			'If this keeps happening, allow your terminal (and launchd) to control '
			+ '"Terminal" and "System Events" in System Settings → Privacy & Security → Automation.',
		);
		return false;
	}
}
