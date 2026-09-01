# SerbisyoToledo UI Feature Parity Checklist

Baseline: `main@65c2a1c6d3f8260357582d03ac5ca19d20bf7cf7`

Purpose: this file is the migration contract. A UI PR cannot be considered complete if an applicable item below disappears, becomes unreachable, or is no longer visible when its original condition is true.

## Global shell and cross-cutting behavior

- [ ] SerbisyoToledo logo/brand remains visible in the appropriate shell.
- [ ] Blue/teal brand identity remains.
- [ ] Light theme remains usable.
- [ ] Dark theme remains usable.
- [ ] English remains usable.
- [ ] Cebuano remains usable.
- [ ] Mobile top bar remains functionally equivalent.
- [ ] Mobile bottom navigation remains functionally equivalent.
- [ ] Desktop role-aware sidebar/navigation remains functionally equivalent.
- [ ] Route changes still scroll new pages to the top.
- [ ] Initial loading screen remains.
- [ ] Footer is present only on the public routes currently intended to show it.
- [ ] Auth pages remain free of the public navbar/footer.
- [ ] Chatbot remains restricted by existing route/role visibility rules.
- [ ] Notification unread behavior remains.
- [ ] Message unread badge remains.
- [ ] Existing protected-route/role guards remain unchanged.

## Public routes

### Home `/`
- [ ] Landing/hero search
- [ ] Real SerbisyoToledo hero/service imagery
- [ ] Popular service categories
- [ ] Browse Services action
- [ ] How It Works
- [ ] Why use SerbisyoToledo / trust benefits
- [ ] Service-provider CTA
- [ ] FAQ
- [ ] Public footer
- [ ] Guest navigation: Home
- [ ] Guest navigation: About
- [ ] Guest navigation: Browse Services
- [ ] Login/Register access

### About `/about`
- [ ] Existing About content remains
- [ ] Existing imagery/animations remain or are visually reimplemented
- [ ] Public navigation/footer behavior remains

### Browse Services `/feed`
- [ ] Search by current supported terms
- [ ] Search state reflected in query params
- [ ] Category filters
- [ ] More/Less categories
- [ ] Service-type filters within category
- [ ] Location filter
- [ ] Minimum price
- [ ] Maximum price
- [ ] Minimum rating
- [ ] Clear individual active filters
- [ ] Clear all filters
- [ ] Provider cards
- [ ] Provider image
- [ ] Provider verification state
- [ ] Service/category labels
- [ ] Skills preview
- [ ] Location
- [ ] Rating/review count
- [ ] Starting price / price-on-request
- [ ] Availability status where currently exposed
- [ ] Open provider profile
- [ ] Discovery guide/tour behavior where currently active
- [ ] Chatbot remains available only according to existing visibility rules

### Public provider profile `/provider/:id`
- [ ] Back to Browse
- [ ] Provider profile photo
- [ ] Provider name
- [ ] Verified state
- [ ] Profession/services
- [ ] Rating/review count
- [ ] Location
- [ ] Availability summary
- [ ] Starting price / price on request
- [ ] Request Service button when allowed
- [ ] Unavailable disabled state when not bookable
- [ ] Preview-mode indication for provider preview
- [ ] About Me
- [ ] Services Offered
- [ ] Skills & Specialties
- [ ] Languages
- [ ] Portfolio tab
- [ ] Completed-work cards
- [ ] Completed-through-platform indication
- [ ] Portfolio images/placeholder behavior
- [ ] Reviews tab
- [ ] Rating summary
- [ ] Review list
- [ ] Image expansion where currently supported
- [ ] Booking modal entry point
- [ ] Login redirect/prompt behavior for unauthenticated request attempts
- [ ] Chatbot remains route/role appropriate
- [ ] Public footer when applicable

### Terms `/terms`
- [ ] Existing terms content/routes remain

### Privacy `/privacy`
- [ ] Existing privacy content/routes remain
- [ ] Provider-verification privacy anchor remains usable

## Authentication

### Login `/login`
- [ ] Login form
- [ ] Error feedback
- [ ] Forgot password link
- [ ] Register link/role-aware behavior
- [ ] Existing logo/brand presentation
- [ ] No public navbar/footer

### Register `/register`
- [ ] Role selection
- [ ] Existing registration fields
- [ ] Existing language-related registration behavior
- [ ] Validation/errors
- [ ] Verification-email flow
- [ ] Login link
- [ ] Existing logo/brand presentation
- [ ] No public navbar/footer

### Forgot password `/forgot-password`
- [ ] Email input/action
- [ ] Feedback states
- [ ] Return/navigation behavior
- [ ] No public navbar/footer

### Reset password `/reset-password/:token`
- [ ] New-password flow
- [ ] Validation/errors
- [ ] Completion navigation
- [ ] No public navbar/footer

### Verify email `/verify-email`
- [ ] Verification processing
- [ ] Success/error states
- [ ] Resend path where supported
- [ ] No public navbar/footer

## Client workspace

### Navigation
- [ ] Dashboard
- [ ] Browse Services
- [ ] Requests / My Bookings
- [ ] Messages
- [ ] Notifications
- [ ] Edit Profile
- [ ] Settings
- [ ] Logout
- [ ] Message unread badge

### Client Dashboard `/client-dashboard`
- [ ] Welcome/header
- [ ] Find Service action
- [ ] Profile/onboarding checklist
- [ ] Pending request count
- [ ] Active request count
- [ ] Completed request count
- [ ] Current requests
- [ ] View All requests
- [ ] Open request detail from current-request row
- [ ] Browse Services quick action
- [ ] Requests quick action
- [ ] Notifications quick action
- [ ] Account Settings quick action

### Requests `/requests` — client
- [ ] Request list
- [ ] Existing filters/tabs/status grouping
- [ ] Open request details
- [ ] Status labels
- [ ] Provider information
- [ ] Schedule information
- [ ] Specific-date schedule display
- [ ] Range schedule display
- [ ] Estimated total when present
- [ ] Job details
- [ ] Service location
- [ ] Decline/cancellation reason display
- [ ] Reschedule history
- [ ] Respond to provider reschedule when applicable
- [ ] Message Provider
- [ ] Report User
- [ ] Cancel pending request
- [ ] Cancel accepted request
- [ ] Propose Reschedule on accepted request
- [ ] Mark Service Complete when client confirmation is applicable
- [ ] Leave a Review after completion when no review exists
- [ ] Review Submitted state
- [ ] Archive/unarchive controls where currently surfaced

### Booking modal
- [ ] One Day
- [ ] Date Range
- [ ] Specific / non-consecutive dates when enabled
- [ ] Click range selection
- [ ] Drag range selection
- [ ] Unavailable dates disabled
- [ ] Provider-defined available dates
- [ ] Estimated duration
- [ ] Daily rate
- [ ] Estimated total
- [ ] Common available time slots
- [ ] Change date
- [ ] Service type selection
- [ ] Service location
- [ ] Job details
- [ ] Booking summary
- [ ] Send Request
- [ ] Success state
- [ ] Back/Continue/Close controls

### Messages `/messages` — client
- [ ] Conversation list
- [ ] Unread counts
- [ ] Open conversation
- [ ] Service label
- [ ] Request status
- [ ] Message history/system events
- [ ] Send message
- [ ] Auto-scroll behavior remains correct
- [ ] Request Phone Number when allowed
- [ ] Pending phone-share state
- [ ] Accept/decline incoming phone-share request
- [ ] Shared phone display
- [ ] Mobile back-to-conversations behavior

### Notifications `/notifications` — client
- [ ] Notification list
- [ ] Unread visual state
- [ ] Open destination/request
- [ ] Mark notification read
- [ ] Mark all as read
- [ ] Clear all
- [ ] Existing notification type icons/meaning

### Client Settings `/client-settings`
- [ ] Account section
- [ ] Contact section
- [ ] Security section
- [ ] Full name
- [ ] Email display
- [ ] Email-change-not-supported helper
- [ ] Account-created date where available
- [ ] Phone number
- [ ] Address
- [ ] Phone privacy help
- [ ] Email verification status
- [ ] Resend verification email
- [ ] Change Password
- [ ] Save Changes
- [ ] Reset

### Client Edit Profile
- [ ] Existing editable client profile fields
- [ ] Existing photo behavior
- [ ] Save/cancel behavior

## Service-provider workspace

### Navigation
- [ ] Dashboard
- [ ] Requests
- [ ] Messages
- [ ] Schedule
- [ ] Notifications
- [ ] Service Listing / Post Service Listing
- [ ] Provider Profile when listing exists
- [ ] Availability when listing exists
- [ ] Credentials when listing exists
- [ ] View Profile as Client when public profile exists
- [ ] Settings
- [ ] Logout
- [ ] Message unread badge

### Provider Dashboard `/dashboard`
- [ ] Welcome/header
- [ ] Profile completion/setup checklist
- [ ] Verification status and request-verification path
- [ ] Service-listing status
- [ ] Availability status
- [ ] Portfolio/profile status
- [ ] Request summary
- [ ] Pending requests
- [ ] Active requests
- [ ] Completed requests
- [ ] Upcoming/active request display
- [ ] Correct schedule display for one-day/range/specific-date requests
- [ ] Open Request Details
- [ ] Relevant dashboard actions for listing/profile/availability/verification
- [ ] Existing tips/guidance

### Provider Requests `/requests`
- [ ] Request list
- [ ] Search/filter/status behavior
- [ ] Open Request Details
- [ ] Client information
- [ ] Schedule details
- [ ] Specific dates
- [ ] Date ranges
- [ ] Estimated total
- [ ] Job details
- [ ] Service location
- [ ] Decline/cancellation reasons
- [ ] Reschedule history
- [ ] Accept reschedule when applicable
- [ ] Decline reschedule when applicable
- [ ] Message Client
- [ ] Report User
- [ ] Accept pending request
- [ ] Decline pending request with required reason
- [ ] Mark On the Way
- [ ] Start Service
- [ ] Mark Service Complete
- [ ] Cancel accepted request where supported
- [ ] Propose Reschedule
- [ ] Archive/unarchive controls where currently surfaced

### Provider Messages `/messages`
- [ ] Conversation list
- [ ] Unread counts
- [ ] Open conversation
- [ ] Service/request context
- [ ] Request status
- [ ] Message history/system events
- [ ] Send message
- [ ] Auto-scroll behavior
- [ ] Accept pending request from Messages
- [ ] Decline pending request from Messages
- [ ] Required decline reason
- [ ] Request Phone Number when allowed
- [ ] Respond to incoming phone-share request
- [ ] Shared phone display
- [ ] Mobile back-to-conversations behavior

### Provider Schedule `/provider-schedule`
- [ ] Manage Availability action
- [ ] Pending request summary
- [ ] Upcoming dates summary
- [ ] Active jobs summary
- [ ] Calendar
- [ ] Today control
- [ ] Month view
- [ ] Week view
- [ ] Day view
- [ ] Calendar events
- [ ] Next Up / Upcoming Jobs
- [ ] Open request from upcoming row
- [ ] View All Requests

### Provider Availability `/provider-availability`
- [ ] Listing-required state if no service listing
- [ ] Go to Dashboard
- [ ] Accepting Bookings toggle
- [ ] Weekdays preset
- [ ] Weekends preset
- [ ] Every Day preset
- [ ] Selected Days preset
- [ ] Weekday selector
- [ ] Morning time preset
- [ ] Afternoon time preset
- [ ] Whole Day time preset
- [ ] Custom time
- [ ] Start/end time inputs
- [ ] Apply Preset
- [ ] Availability calendar
- [ ] Selected date count
- [ ] Selected dates list
- [ ] Clear Dates
- [ ] Per-date Change Time
- [ ] Per-date custom hours
- [ ] Use Usual Hours/reset override
- [ ] Save per-date edit
- [ ] Cancel per-date edit
- [ ] Save Availability
- [ ] Ready/Paused summary
- [ ] Existing validation/error feedback

### Service Listing
- [ ] Create listing
- [ ] Edit listing
- [ ] Provider/account name behavior
- [ ] Barangay address/location
- [ ] Starting daily price
- [ ] Service categories
- [ ] Service types
- [ ] Listing banner upload/preview
- [ ] Existing required-field validation
- [ ] Existing verification/listing gating
- [ ] Save/Post Service Listing
- [ ] Terms/Privacy links

### Provider Profile editor
- [ ] Provider profile picture
- [ ] Upload/change photo
- [ ] Remove photo
- [ ] About Me
- [ ] Cebuano language selection
- [ ] English language selection
- [ ] Filipino language selection
- [ ] Response Time
- [ ] Skills list
- [ ] Add skill
- [ ] Remove skill
- [ ] Completed-request selector
- [ ] Optional completed-job photo
- [ ] Link Job to Portfolio
- [ ] Existing completed-job privacy behavior
- [ ] Existing portfolio grid
- [ ] Update linked-job photo
- [ ] Remove portfolio item where currently supported
- [ ] Existing no-standalone-published-work rule
- [ ] Save/cancel

### Provider verification
- [ ] Verification Request entry point
- [ ] Full name
- [ ] Phone number
- [ ] Address
- [ ] Service description
- [ ] Government ID upload
- [ ] Optional certification/license upload
- [ ] Consent checkbox
- [ ] Privacy Notice link
- [ ] Submit Verification Request
- [ ] Validation/success/error states

### Credentials `/provider-credentials`
- [ ] Existing credentials list/status
- [ ] Credential name
- [ ] Credential type
- [ ] Professional License type
- [ ] TESDA Certification type
- [ ] Safety Training type
- [ ] Technical Certification type
- [ ] Government Accreditation type
- [ ] Manufacturer Certification type
- [ ] Training Certificate type
- [ ] Other type
- [ ] Issuing organization
- [ ] Credential ID
- [ ] Issue date
- [ ] Expiration date
- [ ] Does Not Expire
- [ ] Credential URL
- [ ] Document upload
- [ ] Create/add credential
- [ ] Submit credential for review
- [ ] Verification status
- [ ] Rejection/status feedback

### Provider Settings `/provider-settings`
- [ ] Account-only structure remains
- [ ] Full name
- [ ] Email
- [ ] Email verification status
- [ ] Resend verification email
- [ ] Personal phone
- [ ] Phone privacy help
- [ ] Change Password
- [ ] Save Changes
- [ ] Reset
- [ ] Schedule is NOT reintroduced as a settings subpage
- [ ] Credentials are NOT duplicated as a settings subpage

### Public-profile preview
- [ ] View Profile as Client
- [ ] Desktop preview mode
- [ ] Mobile preview mode
- [ ] Preview cannot accidentally perform client-only booking actions

## Admin

### Navigation
- [ ] Dashboard
- [ ] Users
- [ ] Verification Requests
- [ ] Provider Credential Reviews
- [ ] Reports
- [ ] System Status
- [ ] Pending verification badge
- [ ] Pending credential badge
- [ ] Active-report badge
- [ ] Logout

### Admin Dashboard `/admin/dashboard`
- [ ] Current dashboard stats
- [ ] User/service/platform summaries currently exposed
- [ ] Top/recent verification requests
- [ ] Review Request action
- [ ] Top/recent reports
- [ ] Open report/review path
- [ ] Existing empty/loading/error states

### Users `/admin/users`
- [ ] Search users
- [ ] Filter by user type
- [ ] Filter by status
- [ ] Client filter
- [ ] Service Provider filter
- [ ] Active filter
- [ ] Verified filter
- [ ] Pending filter
- [ ] Suspended filter
- [ ] Mobile user cards
- [ ] Desktop user table
- [ ] View Details
- [ ] Activate/Suspend current status action
- [ ] View Activity
- [ ] User type
- [ ] Profession
- [ ] Status
- [ ] Verification
- [ ] Join date
- [ ] Activity summary
- [ ] Request/report activity facts currently exposed

### Verification Requests `/admin/verifications`
- [ ] Search
- [ ] Status filter
- [ ] Pending count
- [ ] Approved count
- [ ] Rejected count
- [ ] Request applicant details
- [ ] Government ID/document preview
- [ ] Certification/license preview when present
- [ ] Approve
- [ ] Reject
- [ ] Required rejection reason
- [ ] Close document preview

### Provider Credential Reviews `/admin/credentials`
- [ ] Search
- [ ] Status filter
- [ ] Pending count
- [ ] Verified count
- [ ] Rejected count
- [ ] Provider
- [ ] Credential name/type
- [ ] Credential metadata
- [ ] Document preview
- [ ] Approve/verify
- [ ] Reject
- [ ] Required rejection reason
- [ ] Expire action if currently available
- [ ] Close document preview

### Reports `/admin/reports`
- [ ] Search
- [ ] Status filter
- [ ] Pending count
- [ ] Under Review count
- [ ] Resolved count
- [ ] Reported user
- [ ] Reporter
- [ ] Reporter/reported-user types
- [ ] Reason
- [ ] Description
- [ ] Related service request label
- [ ] Date
- [ ] Current action taken
- [ ] Expand report
- [ ] Evidence screenshot
- [ ] Full screenshot preview
- [ ] Investigate / under-review flow
- [ ] Dismiss
- [ ] Resolve
- [ ] Warn
- [ ] Suspend
- [ ] Ban
- [ ] Required/optional moderation notes according to current action
- [ ] Processed-state display

### System Status `/admin/settings`
- [ ] Read-only system-status page
- [ ] Refresh Status
- [ ] Refreshing state
- [ ] API health
- [ ] Health status/message
- [ ] Operational notes
- [ ] No unrelated settings controls are introduced

## Regression gates

- [ ] Frontend `npm run lint`
- [ ] Frontend `npm test`
- [ ] Frontend `npm run build`
- [ ] Backend `npm test`
- [ ] No new failures relative to baseline
- [ ] No new console errors in critical routes
- [ ] Guest smoke test
- [ ] Client smoke test
- [ ] Provider smoke test
- [ ] Admin smoke test
- [ ] 320px
- [ ] 360px
- [ ] 390px
- [ ] 430px
- [ ] Desktop
- [ ] Light
- [ ] Dark
- [ ] English
- [ ] Cebuano
- [ ] Keyboard navigation
- [ ] No clipped critical actions
- [ ] No hidden critical actions
- [ ] No accidental Aoxa-only feature additions

## Merge sign-off

- [ ] Every applicable parity item above checked
- [ ] Working branch reviewed against baseline
- [ ] Backup branch still points to baseline commit
- [ ] PR contains visual-only changes except explicitly approved UI dependency/config changes
- [ ] No backend/database contract changes
- [ ] Main merge performed only after final approval
