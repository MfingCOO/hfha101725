
'use server';
/**
 * @fileOverview This function automatically nudges clients who have not interacted in a while.
 * It's designed to be run on a schedule (e.g., via a cron job).
 */

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { COACH_UIDS } from '@/lib/coaches';
import { postMessageAction } from '@/app/chats/actions';
import nudges from '@/lib/nudges.json';

const NudgeInputSchema = z.object({
  dryRun: z.boolean().optional().default(false),
});
export type NudgeInput = z.infer<typeof NudgeInputSchema>;

const NudgeOutputSchema = z.object({
  nudgedClients: z.array(z.object({
    chatId: z.string(),
    clientName: z.string(),
    message: z.string(),
  })),
  totalNudged: z.number(),
});
export type NudgeOutput = z.infer<typeof NudgeOutputSchema>;

export async function automatedClientNudge(input: NudgeInput): Promise<NudgeOutput> {
    const { dryRun = false } = input;
    console.log('Starting automated client nudge function...');
    const now = Timestamp.now();
    const fortyEightHoursAgo = Timestamp.fromMillis(now.toMillis() - 48 * 60 * 60 * 1000);

    const chatsRef = adminDb.collection('chats');
    const q = chatsRef
      .where('type', '==', 'coaching')
      .where('lastClientMessage', '<=', fortyEightHoursAgo);

    const snapshot = await q.get();
    if (snapshot.empty) {
        console.log("No clients need nudging.");
        return { nudgedClients: [], totalNudged: 0 };
    }

    const coaches = [
        { uid: COACH_UIDS[0], name: "Alan Roberts" },
        { uid: COACH_UIDS[1], name: "Crystal Roberts" },
    ];

    const nudgedClients: NudgeOutput['nudgedClients'] = [];

    for (const chatDoc of snapshot.docs) {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;

        const lastClientMsgTimestamp = (chatData.lastClientMessage as Timestamp);
        const lastAutomatedMsgTimestamp = chatДata.lastAutomatedMessage as Timestamp | undefined;

        if (lastAutomatedMsgTimestamp) {
            const clientHasRepliedSinceLastNudge = lastClientMsgTimestamp.toMillis() > lastAutomatedMsgTimestamp.toMillis();
            if (clientHasRepliedSinceLastNudge) {
                // Client replied, so the 48-hour inactivity timer has already restarted for them via the main query.
                // We can proceed to nudge them.
            } else {
                 const hoursSinceLastNudge = (now.toMillis() - lastAutomatedMsgTimestamp.toMillis()) / (1000 * 60 * 60);
                 if(hoursSinceLastNudge < 24) {
                    console.log(`Skipping ${chatData.name}, recently nudged ${hoursSinceLastNudge.toFixed(1)} hours ago.`);
                    continue;
                }
            }
        }

        const clientUid = chatData.participants.find((p: string) => !COACH_UIDS.includes(p));
        if (!clientUid) {
            console.warn(`Could not find client in chat ${chatId}`);
            continue;
        }

        const sendingCoach = coaches[Math.floor(Math.random() * coaches.length)];
        const nudgeTemplate = nudges[Math.floor(Math.random() * nudges.length)];
        const messageText = nudgeTemplate
            .replace('{clientName}', chatData.name)
            .replace('{coachName}', sendingCoach.name.split(' ')[0]);

        nudgedClients.push({
            chatId: chatId,
            clientName: chatData.name,
            message: messageText,
        });

        if (!dryRun) {
            console.log(`Sending nudge to ${chatData.name} in chat ${chatId}`);
            await postMessageAction({
                chatId: chatId,
                text: messageText,
                userId: sendingCoach.uid,
                userName: sendingCoach.name,
                isCoach: true,
                isAutomated: true,
            });
        }
    }

    console.log(`Nudge function complete. ${dryRun ? '[DRY RUN]' : ''} Nudged ${nudgedClients.length} clients.`);
    return { nudgedClients, totalNudged: nudgedClients.length };
}
