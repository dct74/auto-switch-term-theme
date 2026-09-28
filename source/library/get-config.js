import Conf from 'conf';
import {getTerminalDefaultProfile} from 'mac-terminal';
import packageJson from '#package-json' with {type: 'json'};

// This project is a fork of patrik-csak/auto-terminal-profile. Anyone upgrading
// from the upstream package already has profiles configured under the old name,
// so migrate them the first time we run.
const upstreamProjectName = 'auto-terminal-profile';
const migrationFlag = 'migratedFromUpstream';

const schema = {
	profiles: {
		properties: {
			dark: {
				type: 'string',
			},
			light: {
				type: 'string',
			},
		},
		type: 'object',
	},
	[migrationFlag]: {
		type: 'boolean',
	},
};

function migrateFromUpstream(config) {
	if (config.get(migrationFlag)) {
		return;
	}

	try {
		const upstreamConfig = new Conf({projectName: upstreamProjectName});
		const upstreamProfiles = upstreamConfig.get('profiles');

		if (upstreamProfiles?.dark && upstreamProfiles.light) {
			config.set('profiles', {
				dark: upstreamProfiles.dark,
				light: upstreamProfiles.light,
			});
		}
	} catch {
		// Missing or unreadable upstream config: nothing to migrate.
	}

	config.set(migrationFlag, true);
}

export default async function getConfig() {
	const defaultProfile = await getTerminalDefaultProfile();

	const config = new Conf({
		defaults: {
			profiles: {
				dark: defaultProfile,
				light: defaultProfile,
			},
		},
		projectName: packageJson.name,
		schema,
	});

	migrateFromUpstream(config);

	return config;
}
