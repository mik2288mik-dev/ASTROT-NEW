import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { handleAdminError } from '../../../lib/adminAuth';
import { getPremiumEntitlementState, publicPremiumEntitlementSnapshot } from '../../../lib/contentArchitecture';
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
    const [birthSettings,premiumEntitlement,legalDocuments]=await Promise.all([
      birthProfileRepository.get(auth.userId),
      getPremiumEntitlementState(auth.userId),
      getLegalDocumentStatusesForUser(auth.userId),
    ]);
    const profile=toPublicAppProfile({...user,...birthSettings},auth);
    const publicEntitlement=publicPremiumEntitlementSnapshot(premiumEntitlement);
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
