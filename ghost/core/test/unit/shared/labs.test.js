const assert = require('assert/strict');
const sinon = require('sinon');

const configUtils = require('../../utils/configUtils');
const labs = require('../../../core/shared/labs');
const settingsCache = require('../../../core/shared/settings-cache');

function expectedLabsObject(obj) {
    let enabledFlags = {};

    labs.GA_KEYS.forEach((key) => {
        enabledFlags[key] = true;
    });

    enabledFlags = Object.assign(enabledFlags, obj);
    return enabledFlags;
}

describe('Labs Service', function () {
    afterEach(async function () {
        sinon.restore();
        await configUtils.restore();
    });

    it('can getAll, even if empty with enabled members', function () {
        assert.deepEqual(labs.getAll(), expectedLabsObject({
            members: true
        }));
    });

    it('returns an alpha flag when dev experiments in toggled', function () {
        configUtils.set('enableDeveloperExperiments', true);
        sinon.stub(process.env, 'NODE_ENV').value('production');
        const getSpy = sinon.stub(settingsCache, 'get');
        getSpy.withArgs('labs').returns({
            urlCache: true
        });

        // NOTE: this test should be rewritten to test the alpha flag independently of the internal ALPHA_FEATURES list
        //       otherwise we end up in the endless maintenance loop and need to update it every time a feature graduates from alpha
        assert.deepEqual(labs.getAll(), expectedLabsObject({
            urlCache: true,
            members: true
        }));

        assert.equal(labs.isSet('members'), true);
        assert.equal(labs.isSet('urlCache'), true);
    });

    it('respects the value in config over settings', function () {
        configUtils.set('labs', {
            collections: false
        });
        const getSpy = sinon.stub(settingsCache, 'get');
        getSpy.withArgs('labs').returns({
            collections: true,
            members: true
        });

        assert.deepEqual(labs.getAll(), expectedLabsObject({
            collections: false,
            members: true
        }));

        assert.equal(labs.isSet('collections'), false);
    });

    it('respects the value in config over GA keys', function () {
        configUtils.set('labs', {
            audienceFeedback: false
        });

        assert.deepEqual(labs.getAll(), expectedLabsObject({
            audienceFeedback: false,
            members: true
        }));

        assert.equal(labs.isSet('audienceFeedback'), false);
    });

    it('members flag is true when members_signup_access setting is "all"', function () {
        const getSpy = sinon.stub(settingsCache, 'get');
        getSpy.withArgs('members_signup_access').returns('all');

        assert.deepEqual(labs.getAll(), expectedLabsObject({
            members: true
        }));

        assert.equal(labs.isSet('members'), true);
    });

    it('returns other allowlisted flags along with members', function () {
        const getSpy = sinon.stub(settingsCache, 'get');
        getSpy.withArgs('members_signup_access').returns('all');
        getSpy.withArgs('labs').returns({
            activitypub: false
        });

        assert.deepEqual(labs.getAll(), expectedLabsObject({
            members: true,
            activitypub: false
        }));

        assert.equal(labs.isSet('members'), true);
        assert.equal(labs.isSet('activitypub'), false);
    });

    it('members flag is false when members_signup_access setting is "none"', function () {
        const getSpy = sinon.stub(settingsCache, 'get');
        getSpy.withArgs('members_signup_access').returns('none');

        assert.deepEqual(labs.getAll(), expectedLabsObject({
            members: false
        }));

        assert.equal(labs.isSet('members'), false);
    });

    it('isSet returns false for undefined', function () {
        assert.equal(labs.isSet('bar'), false);
    });

    it('isSet always returns false for deprecated', function () {
        assert.equal(labs.isSet('subscribers'), false);
        assert.equal(labs.isSet('publicAPI'), false);
    });
});

describe('Labs Service - Flag Integrity', function () {
    it('should have no duplicate flags across categories', function () {
        const allFlags = labs.getAllFlags();

        const duplicates = allFlags.filter((flag, index) => allFlags.indexOf(flag) !== index);

        assert.equal(duplicates.length, 0, `There are duplicate flags in the labs configuration: ${duplicates.join(', ')}`);
    });
});

describe('Labs Service - Privileged Announcement Flags', function () {
    it('foo is a writable private flag', function () {
        assert.ok(labs.WRITABLE_KEYS_ALLOWLIST.includes('foo'), 'foo should be in WRITABLE_KEYS_ALLOWLIST');
    });

    it('safeguard is a writable private flag', function () {
        assert.ok(labs.WRITABLE_KEYS_ALLOWLIST.includes('safeguard'), 'safeguard should be in WRITABLE_KEYS_ALLOWLIST');
    });

    it('isPrivilegedAnnouncementFlag returns true for foo', function () {
        assert.equal(labs.isPrivilegedAnnouncementFlag('foo'), true);
    });

    it('isPrivilegedAnnouncementFlag returns true for safeguard', function () {
        assert.equal(labs.isPrivilegedAnnouncementFlag('safeguard'), true);
    });

    it('isPrivilegedAnnouncementFlag returns false for a regular flag', function () {
        assert.equal(labs.isPrivilegedAnnouncementFlag('webmentions'), false);
        assert.equal(labs.isPrivilegedAnnouncementFlag('announcementBar'), false);
        assert.equal(labs.isPrivilegedAnnouncementFlag('nonExistent'), false);
    });

    it('no GA_KEYS or PUBLIC_BETA_FEATURES flag is also a privileged announcement flag', function () {
        // GA flags are always-on; PUBLIC_BETA are user-toggleable without dev experiments.
        // Neither should ever be a privileged announcement flag.
        const publicAndGaFlags = [
            ...labs.GA_KEYS,
            'superEditors', 'editorExcerpt', 'additionalPaymentMethods'
        ];
        publicAndGaFlags.forEach((flag) => {
            assert.equal(
                labs.isPrivilegedAnnouncementFlag(flag),
                false,
                `GA/public flag "${flag}" must NOT be a privileged announcement flag`
            );
        });
    });

    it('getPrivilegedAnnouncementFlags returns foo and safeguard', function () {
        const privileged = labs.getPrivilegedAnnouncementFlags();
        assert.ok(Array.isArray(privileged));
        assert.ok(privileged.includes('foo'), 'should include foo');
        assert.ok(privileged.includes('safeguard'), 'should include safeguard');
    });

    it('privileged announcement flags must all appear in WRITABLE_KEYS_ALLOWLIST', function () {
        const privileged = labs.getPrivilegedAnnouncementFlags();
        privileged.forEach((flag) => {
            assert.ok(
                labs.WRITABLE_KEYS_ALLOWLIST.includes(flag),
                `Privileged flag "${flag}" must be in WRITABLE_KEYS_ALLOWLIST (PRIVATE_FEATURES)`
            );
        });
    });

    it('privileged announcement flags must NOT appear in GA_KEYS', function () {
        const privileged = labs.getPrivilegedAnnouncementFlags();
        privileged.forEach((flag) => {
            assert.ok(
                !labs.GA_KEYS.includes(flag),
                `Privileged flag "${flag}" must NOT be in GA_KEYS (should require explicit opt-in)`
            );
        });
    });
});
