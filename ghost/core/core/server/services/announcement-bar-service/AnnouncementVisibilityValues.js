// Available visibilities:
// 'visitors'     - anonymous visitors
// 'free_members' - free members
// 'paid_members' - paid members (aka non-free members)
// 'admin'        - site administrators only (maximum security / privileged access)
class AnnouncementVisibilityValues {
    static VISITORS = 'visitors';
    static FREE_MEMBERS = 'free_members';
    static PAID_MEMBERS = 'paid_members';
    static ADMIN = 'admin';
}

module.exports = AnnouncementVisibilityValues;
