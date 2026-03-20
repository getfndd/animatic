import { Config } from '@remotion/cli/config';
import dns from 'node:dns';

// Force IPv4 — Node 20 resolves localhost to ::1 (IPv6) by default,
// which causes Remotion's server to hang. See remotion-dev/remotion#4329.
dns.setDefaultResultOrder('ipv4first');

Config.setEntryPoint('./src/remotion/index.js');
Config.setIPv4(true);
