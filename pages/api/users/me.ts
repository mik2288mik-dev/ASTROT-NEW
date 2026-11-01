import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { natalChartV2Repository } from '../../../lib/natalChartV2Repository';
import { savedPrimaryNatalMatchesProfile } from '../../../lib/onboardingRecovery';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { handleAdminError } from '../../../lib/adminAuth';
import { getPremiumEntitlementState, publicPremiumEntitlementSnapshot } from '../../../lib/contentArchitecture';
import { queuePersonalForecastPrewarmForUser } from '../../../lib/personalForecastPrewarm';
import {
  CURRENT_LEGAL_DOCUMENT_VERSIONS,
  getLegalDocumentStatusesForUser,
} from '../../../lib/legalAcknowledgement';

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Authorization, Cookie');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=await requireAppUser(req,{allowGuest:true});
    const user=await db.users.get(auth.userId,{hydratePrimaryChart:false});
    if(!user)return res.status(404).json({error:'User not found'});
    if((user as {is_blocked?:boolean}).is_blocked)return res.status(403).json({error:'ACCOUNT_BLOCKED',code:'ACCOUNT_BLOCKED',message:'Аккаунт заблокирован.'});
    // Recover existing accounts stuck in old APK onboarding: the canonical chart
    // was saved, but the client awaited an AI reading before setting is_setup.
    let setupRecovered = false;
    if(user.is_setup !== true && user.birth_date && user.birth_place) {
      try {
        const chart = await natalChartV2Repository.getPrimary(auth.userId);
        if(savedPrimaryNatalMatchesProfile(user, chart)) {
          const saved = await db.users.updateExisting(auth.userId, {is_setup:true});
          setupRecovered = saved?.is_setup === true;
        }
      } catch(error) {
        console.warn('[API/users/me] saved-chart onboarding recovery failed',
          error instanceof Error ? error.message : String(error));
      }
    }
    const [birthSettings,premiumEntitlement,legalDocuments]=await Promise.all([
      birthProfileRepository.get(auth.userId),
      getPremiumEntitlementState(auth.userId),
      getLegalDocumentStatusesForUser(auth.userId),
    ]);
    const profile=toPublicAppProfile({...user,...birthSettings,is_setup:user.is_setup === true || setupRecovered},auth);
    const publicEntitlement=publicPremiumEntitlementSnapshot(premiumEntitlement);
    try {
      queuePersonalForecastPrewarmForUser({
        userId:auth.userId,
        accessTier:premiumEntitlement.isPremium?'premium':'free',reason:'app_open',
      });
    } catch (error) {
      console.warn('[API/users/me] forecast prewarm trigger failed',error);
    }
    return res.status(200).json({
      ...profile,
      isPremium:publicEntitlement.isPremium,
      premiumUntil:publicEntitlement.endsAt,
      premiumEntitlement:publicEntitlement,
      legalAcknowledgements:{
        requiredVersions:CURRENT_LEGAL_DOCUMENT_VERSIONS,
        documents:legalDocuments,
      },
    });
  }catch(error){return handleAdminError(res,error);}
}
