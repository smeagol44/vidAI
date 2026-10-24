/** Optional read-only paid-learning receipts. No observer changes spending. */
export type LearningReceipt=Readonly<{organism:string;category:'motor'|'sensory';edges:number;upkeepJ:number;rewriteJ:number;requestedRewriteJ:number;costJ:number}>;
export type LearningObserver=(receipt:LearningReceipt)=>void;
