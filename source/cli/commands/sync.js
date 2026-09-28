import {Command} from 'commander';
import * as actions from '#cli/actions';

export default new Command('sync')
	.description('switch the Terminal profile to match the current appearance mode')
	.option('--force', 'apply the profile even when it already matches')
	.action(async options => actions.sync({force: Boolean(options.force)}));
