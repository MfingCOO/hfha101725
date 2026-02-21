
import { db } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';
import { differenceInCalendarDays, subMinutes, subHours, set } from 'date-fns';
import { createUserNotification } from '@/services/reminders';
import { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

// Define the milestone days
const MILESTONES = [3, 7, 14, 21, 28, 60, 90, 180, 365];

async function handleStreakChecks() {
    const clientsSnapshot = await db.collection('clients').get();
    
    if (clientsSnapshot.empty) {
      console.log('[Cron Job] No clients found for streak checks.');
      return;
    }

    const promises = clientsSnapshot.docs.map(async (doc) => {
      const client = doc.data() as UserProfile;
      const userId = doc.id;

      if (!client.bingeFreeSince) {
        return;
      }

      const bingeFreeSinceDate = (client.bingeFreeSince as any).toDate();
      const now = new Date();
      const currentStreak = differenceInCalendarDays(now, bingeFreeSinceDate);
      
      if (currentStreak <= 0) {
        return;
      }

      if (MILESTONES.includes(currentStreak)) {
        const achievedMilestones = client.achievedStreakMilestones || [];
        
        if (!achievedMilestones.includes(currentStreak)) {
          await createUserNotification(userId, {
            type: 'streak-congrats',
            title: 'Congratulations! 🎉',
            message: `You\'ve hit a ${currentStreak}-day binge-free streak! Keep up the amazing work.`,
            pillarId: 'trophy',
            deliverAt: Timestamp.now()
          });

          await db.collection('clients').doc(userId).update({
            achievedStreakMilestones: [...achievedMilestones, currentStreak]
          });
        }
      }
    });

    await Promise.all(promises);
}

async function handleAppointmentReminders() {
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    const appointmentsSnapshot = await db.collectionGroup('appointments')
        .where('startTime', '>=', Timestamp.fromDate(now))
        .where('startTime', '<', Timestamp.fromDate(tenMinutesFromNow))
        .get();

    if (appointmentsSnapshot.empty) {
        console.log('[Cron Job] No upcoming appointments requiring reminders.');
        return;
    }

    const promises = appointmentsSnapshot.docs.map(async (doc) => {
        const appointment = doc.data();
        const userId = appointment.userId;
        const coachId = appointment.coachId;
        const appointmentId = doc.id;

        // Notify client
        await createUserNotification(userId, {
            type: 'appointment_reminder',
            title: 'Appointment Reminder',
            message: `Your appointment with ${appointment.coachName} is in 10 minutes.`,
            pillarId: 'calendar',
            entityId: appointmentId,
            deliverAt: Timestamp.fromMillis(doc.data().startTime.toMillis() - 10 * 60 * 1000)
        });

        // Notify coach
        await createUserNotification(coachId, {
            type: 'appointment_reminder',
            title: 'Appointment Reminder',
            message: `Your appointment with ${appointment.clientName} is in 10 minutes.`,
            pillarId: 'calendar',
            entityId: appointmentId,
            deliverAt: Timestamp.fromMillis(doc.data().startTime.toMillis() - 10 * 60 * 1000)
        });
    });

    await Promise.all(promises);
}

async function handleMiaClientChecks() {
    const fortyEightHoursAgo = Timestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000);

    const miaClientsSnapshot = await db.collection('clients')
        .where('lastInteraction', '<=', fortyEightHoursAgo)
        .get();

    if (miaClientsSnapshot.empty) {
        console.log('[Cron Job] No MIA clients found.');
        return;
    }

    const promises = miaClientsSnapshot.docs.map(async (doc) => {
        const client = doc.data() as UserProfile;
        if (client.coachId) {
            await createUserNotification(client.coachId, {
                type: 'mia_alert',
                title: 'Client Inactivity Alert',
                message: `${client.fullName} has not logged any activity in the last 48 hours. It might be a good time to check in.`,
                pillarId: 'chat',
                deliverAt: Timestamp.now()
            });
        }
    });

    await Promise.all(promises);
}

async function handleChallengeCheckinReminders() {
    const clientsSnapshot = await db.collection('clients').where('activeChallengeId', '!=', null).get();

    if (clientsSnapshot.empty) {
        console.log('[Cron Job] No clients with active challenges found.');
        return;
    }

    const promises = clientsSnapshot.docs.map(async (doc) => {
        const client = doc.data() as UserProfile;
        const userId = doc.id;
        const bedtime = client.bedtime || '22:00'; // Default to 10 PM if not set
        const [hours, minutes] = bedtime.split(':').map(Number);
        
        const reminderTime = set(new Date(), { hours: hours - 2, minutes });

        if (reminderTime > new Date()) { // Only schedule for the future
            await createUserNotification(userId, {
                type: 'challenge_checkin',
                title: 'Challenge Check-in',
                message: 'Time to check in with your challenge for the day!',
                pillarId: 'challenges',
                deliverAt: Timestamp.fromDate(reminderTime)
            });
        }
    });

    await Promise.all(promises);
}


export async function GET() {
  try {
    await handleStreakChecks();
    await handleAppointmentReminders();
    await handleMiaClientChecks();
    await handleChallengeCheckinReminders();

    return NextResponse.json({ message: 'Daily tasks completed successfully.' });

  } catch (error: any) {
    console.error('[Cron Job] Error during daily tasks:', error);
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
}
