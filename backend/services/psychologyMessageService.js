// backend/services/psychologyMessageService.js

export const TONE_CATEGORIES = {
  REALITY_CHECK: [
    "This is no longer a small delay. The mission is now at risk.",
    "A plan without starting becomes mental load. Let's break the zero-day streak now.",
    "The longer you stay away, the harder it is to return. Don't wait for the perfect day."
  ],
  RECOVERY: [
    "🚨 CRITICAL RECOVERY MODE\n\nDo not plan 10 hours. Do not wait for motivation. Break the zero-day streak now.\n\nToday's only target:\n✅ Upload ONE study block\n✅ Study for 25 minutes\n✅ Mark it complete",
    "Let's focus on exactly ONE 25-minute Pomodoro. No distraction, no excuses."
  ],
  COMPETITOR_COMPARISON: [
    "While you wait for motivation, others are finishing their options. Consistency wins the rank.",
    "Your competition is studying Art & Culture right now. Every single day counts."
  ],
  IDENTITY_REMINDER: [
    "🚨 EMERGENCY RESTART MODE\n\nYou started this mission to be an officer. Officers do not wait for motivation. They show up. Complete 10 minutes today to protect your identity.",
    "Officer, it's time to restart the engine. A single 10-minute block is enough to turn the tide."
  ],
  DATA_BASED: [
    "The logs don't lie. A 14-day zero streak changes your trajectory. Let's start with a small victory today.",
    "Backlog is building up. The pace required will soon become overwhelming. Act today."
  ],
  GENTLE_RESET: [
    "It's a new day. Let's upload a fresh plan and start the first block on time.",
    "Yesterday is history. Focus on winning the first block today."
  ],
  STRICT_MENTOR: [
    "7 days of no study is unacceptable. The discipline is slipping. Upload a 45-minute block immediately and execute."
  ]
};

/**
 * Get plan not uploaded reminder text based on the user's state.
 */
export function getPlanNotUploadedMessage(state, userName = "Moulika", recoveryDay = 1) {
  const normState = (state || 'HEALTHY').toUpperCase();

  switch (normState) {
    case 'MISSION_FAILURE':
      return `🚨 EMERGENCY RESTART REQUIRED

${userName}, you have gone 21+ days without meaningful study. 

The old plan is dead.
We are resetting from zero today.

Today’s only target:
✅ Upload ONE tiny study block (10–20 minutes)
✅ Complete it and mark it done

Do not think about the exam date.
Do not think about the massive syllabus.
Just show up for 10 minutes today to protect your identity.`;

    case 'CRITICAL':
      return `🚨 CRITICAL RECOVERY MODE

${userName}, 15 days without meaningful study.

This is no longer a small delay.
The mission is now at risk.

Today’s only target:
✅ Upload ONE study block
✅ Study for 25 minutes
✅ Mark it complete

Do not plan 10 hours.
Do not wait for motivation.
Break the zero-day streak now.`;

    case 'HIGH_RISK':
      return `⚠️ HIGH RISK STATE ACTIVE

${userName}, you have not studied for 7 consecutive days.

This is a dangerous trend. The momentum is lost.
We need to stop the decay today.

Today’s recovery target:
✅ Upload a 45-minute study block
✅ Execute it with focus

Let's get back on the wagon. Action cures fear.`;

    case 'AT_RISK':
      return `⚠️ AT RISK STATUS

${userName}, we have hit a 3-day zero-study streak or missed plans.

This is where consistency usually dies.
We must intervene immediately.

Today’s target:
✅ Upload a plan of 60–90 minutes
✅ Finish the first block on time

Don't let this slip into high risk. Upload your plan now.`;

    case 'SLIGHT_RISK':
      return `⚠️ SLIGHT RISK ALERT

${userName}, yesterday was a zero-study day or missed plan.

Let's make sure Day 2 does not become Day 1.
Upload today's plan now and start the first block on time.`;

    case 'RECOVERY':
      return `🔄 RECOVERY IN PROGRESS

${userName}, you are rebuilding the habit.

Today is Day ${recoveryDay} of recovery. Protect the progress.
Target: Upload a light plan.

Let's break the friction early today!`;

    case 'HEALTHY':
    default:
      return `${userName}, today’s plan is not uploaded yet ⚠️

Without a plan, the day becomes reactive.

Upload today’s blocks now:
1. Geography Optional
2. CSAT
3. PYQ/MCQ
4. Revision
5. One answer-writing block`;
  }
}

/**
 * Choose the tone name based on the current state.
 */
export function chooseToneForState(state) {
  const normState = (state || 'HEALTHY').toUpperCase();
  switch (normState) {
    case 'AT_RISK':
      return 'REALITY_CHECK';
    case 'HIGH_RISK':
      return 'STRICT_MENTOR'; // strict mentor + data based
    case 'CRITICAL':
      return 'RECOVERY'; // recovery + reality check
    case 'MISSION_FAILURE':
      return 'IDENTITY_REMINDER'; // identity + recovery
    case 'HEALTHY':
    case 'SLIGHT_RISK':
    default:
      return 'GENTLE_RESET'; // gentle reset / data based
  }
}

/**
 * Get plan not started message based on state.
 */
export function getPlanNotStartedMessage(state, userName = "Moulika", startTime, recoveryDay = 1) {
  const normState = (state || 'HEALTHY').toUpperCase();
  switch (normState) {
    case 'MISSION_FAILURE':
      return `🚨 MISSION FAILURE - PLAN NOT STARTED\n\n${userName}, your plan was scheduled to start at ${startTime}. We reset your plan to 10-20 minutes today. Show up now to break the cycle.`;
    case 'CRITICAL':
      return `🚨 CRITICAL STATE - START NOW\n\n${userName}, you are late for your plan scheduled at ${startTime}. You only need to complete ONE 25-minute block today. Start it now.`;
    case 'HIGH_RISK':
      return `⚠️ HIGH RISK - ESCALATING LATE START\n\n${userName}, your plan scheduled at ${startTime} has not started yet. Break the streak of zero days. Get to your desk.`;
    case 'AT_RISK':
      return `⚠️ AT RISK - LATE START\n\n${userName}, your plan scheduled at ${startTime} has not started. Don't let it slip. Start the first block now.`;
    case 'RECOVERY':
      return `🔄 RECOVERY IN PROGRESS - START TIME PASSED\n\n${userName}, you are rebuilding the habit (Day ${recoveryDay}). Your block scheduled at ${startTime} is waiting. Show up for a quick win.`;
    case 'SLIGHT_RISK':
      return `⚠️ SLIGHT RISK - LATE START\n\n${userName}, your study plan scheduled at ${startTime} is late. Win the first block to protect your streak.`;
    case 'HEALTHY':
    default:
      return `⚠️ *Plan Not Started*\n\n${userName}, your study plan for today was scheduled to start at ${startTime}. It has been more than 15 minutes and you haven't started yet. Let's start the engine!`;
  }
}

/**
 * Get current block not started message based on state.
 */
export function getCurrentBlockNotStartedMessage(state, userName = "Moulika", subject, startTime, recoveryDay = 1) {
  const normState = (state || 'HEALTHY').toUpperCase();
  switch (normState) {
    case 'MISSION_FAILURE':
      return `🚨 restart now: ${subject}\n\n${userName}, this block started at ${startTime}. Execute just 10 minutes. Break the friction.`;
    case 'CRITICAL':
      return `🚨 critical recovery: ${subject}\n\n${userName}, this block started at ${startTime}. You only need to do 25 minutes today. Start now.`;
    case 'HIGH_RISK':
      return `⚠️ high risk: ${subject} not started\n\n${userName}, this block started at ${startTime}. Action cures fear. Start now.`;
    case 'AT_RISK':
      return `⚠️ at risk: ${subject} not started\n\n${userName}, this block was scheduled at ${startTime}. Don't let the day slip.`;
    case 'RECOVERY':
      return `🔄 recovery day ${recoveryDay}: ${subject} not started\n\n${userName}, this block scheduled at ${startTime} is ready. Step up for your recovery.`;
    case 'SLIGHT_RISK':
      return `⚠️ slight risk: ${subject} not started\n\n${userName}, this block was scheduled at ${startTime}. Execute now to keep consistency.`;
    case 'HEALTHY':
    default:
      return `⚠️ *${subject} not started*\n\nThis ${subject} block was scheduled at ${startTime}.\nStart a 25-minute rescue version now.`;
  }
}

/**
 * Get block start reminder message based on state.
 */
export function getBlockStartReminderMessage(state, userName = "Moulika", subject, startTime, endTime, duration, recoveryDay = 1) {
  const normState = (state || 'HEALTHY').toUpperCase();
  switch (normState) {
    case 'MISSION_FAILURE':
      return `▶️ *Start Now (Failure Mode): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, do not think about the backlog. Just study 10 minutes of ${subject} now.`;
    case 'CRITICAL':
      return `▶️ *Start Now (Critical Mode): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, win this single 25-minute block. That is your entire target today.`;
    case 'HIGH_RISK':
      return `▶️ *Start Now (High Risk): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, break the zero streak. Focus purely on ${subject} for the next ${duration || 0} mins.`;
    case 'AT_RISK':
      return `▶️ *Start Now (At Risk): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, show up for ${subject}. Protect your consistency.`;
    case 'RECOVERY':
      return `▶️ *Start Now (Recovery Day ${recoveryDay}): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, block is ready. Rebuild the momentum with ${subject}.`;
    case 'SLIGHT_RISK':
      return `▶️ *Start Now (Slight Risk): ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, let's start ${subject}. Keep your streak alive.`;
    case 'HEALTHY':
    default:
      return `▶️ *Start Now: ${subject}*\nScheduled: ${startTime}–${endTime || '?'}\nDuration: ${duration || 0} min\n\n${userName}, start this block now.\nDon’t think about the whole day. Win this block.`;
  }
}

/**
 * Get recovery invitation message.
 */
export function getRecoveryInvitationMessage(userName = "Moulika") {
  return `🚨 MentorOS Recovery

Hi ${userName},

You've been away from your mission for a while.

That's okay.

Today we are not trying to recover the last few weeks.

We're only trying to recover today.

Would you like to restart?

Reply with one option:
1️⃣ Restart Today
2️⃣ I'm Overwhelmed
3️⃣ I Don't Have Time
4️⃣ I'm Not Motivated
5️⃣ Pause My Mission`;
}

/**
 * Get recovery follow-up message (after 7 days of inactivity).
 */
export function getRecoveryFollowupMessage(userName = "Moulika") {
  return `🚨 MentorOS Recovery

Hi ${userName},

Just checking in. It's been a week since we spoke about restarting.

There is no pressure to catch up on the past. We only focus on today.

Would you like to restart your mission?

Reply with one option:
1️⃣ Restart Today
2️⃣ I'm Overwhelmed
3️⃣ I Don't Have Time
4️⃣ I'm Not Motivated
5️⃣ Pause My Mission`;
}

/**
 * Get recovery weekly check-in message.
 */
export function getRecoveryWeeklyCheckinMessage(userName = "Moulika") {
  return `🚨 MentorOS Weekly Check-in

Hi ${userName},

I'm still here to help you rebuild your UPSC study habit whenever you're ready.

No backlog tracking, no pressure. Just a single block to get back in the flow.

Reply with "Restart" when you're ready to take the first step.`;
}

/**
 * Get the canned response text for a chosen recovery option.
 */
export function getRecoveryOptionResponse(option) {
  const opt = Number(option);
  switch (opt) {
    case 1:
      return `Excellent.

Forget the last 21+ days.

Today's mission is simple.

✅ Upload ONE study block.

Study for only 25 minutes.

Nothing else.

When finished, MentorOS automatically creates Recovery Day 1.`;
    case 2:
      return `Then don't think about the entire UPSC syllabus.

Open the easiest subject.

Read for 10 minutes.

That is enough for today.`;
    case 3:
      return `Then don't aim for hours.

Give yourself just 15 minutes before sleeping.

Consistency matters more than duration.`;
    case 4:
      return `Motivation comes after action.

Not before.

Let's complete one small block together.

25 minutes.

That's today's only mission.`;
    case 5:
      return `Understood.

I'll stop daily performance reminders.

Whenever you're ready,

send:

Restart

and we'll rebuild your mission together.`;
    default:
      return "";
  }
}

/**
 * 9:00 AM Strict No-Plan Message
 */
export function getNoPlanStrict9AMMessage(userName = "Moulika") {
  return `${userName}, it is 9 AM and no plan is uploaded yet.
Without a plan, today will again become a zero-study day.
Upload even a 45-minute plan now. Don't wait for motivation.`;
}

/**
 * 12:00 PM Recovery Plan Message
 */
export function getRecoveryPlan12PMMessage(userName = "Moulika") {
  return `It is 12 PM. The morning is gone, but the day is not gone.
Upload a 45-minute recovery plan now.
Target: one small block. No excuses. Break the zero-study streak today.`;
}

/**
 * 3:00 PM High Risk Intervention Message
 */
export function getHighRiskIntervention3PMMessage(userName = "Moulika") {
  return `${userName}, it is 3 PM and you still haven't uploaded today's plan.
This is no longer a planning issue. This is avoidance.

You don't need a perfect timetable now.
You need one honest study block.

Do this now:
1. Choose one subject
2. Study for 45 minutes
3. Upload proof after completion

Today's mission is not 8 hours.
Today's mission is to stop the zero-study streak.
Start now.`;
}

/**
 * 6:00 PM Emergency Non-Zero Message
 */
export function getEmergencyNonZero6PMMessage(userName = "Moulika") {
  return `${userName}, only the evening is left.
Don't try to save the full day. Save your discipline.
Sit for just 25 minutes now and upload proof.
A small win today is better than another zero day.`;
}

