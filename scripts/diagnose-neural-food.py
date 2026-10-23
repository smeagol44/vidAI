"""Read-only aggregation of fixed archives; no simulation or selection."""
import json,gzip,pathlib,collections
p=pathlib.Path('docs/experiments');m=json.loads((p/'neural-food-v1.json').read_text())
runs=[json.loads(gzip.decompress((p/e['archive']).read_bytes())) for e in m['runs']]
trials=[];mutations={'hybridWithBothOutputRoles':0,'selectedHybridWithBothOutputRoles':0};modes={};elite={};eating=collections.Counter()
maxima={k:0 for k in ['chemicalErrorJ','partitionResidualJ','maxConstraintGainJ','deliveryError','guards','energyLimited','limitRad','anchorPx','peakConstraintOmega','peakPostContactOmega']}
progress=[json.loads(l) for l in gzip.decompress((p/'neural-food-v1-run.log.gz').read_bytes()).decode().splitlines() if l.startswith('{') and '"generation"' in l]
assert len(progress)==324
for d in runs:
    trials += [d['initial']['trial']]+[o['trial'] for g in d['generations'] for o in g['offspring']]+[h['trial'] for h in d['heldOut']]+[c['trial'] for c in d['controls']]
    for g in d['generations']:
        log=next(r for r in progress if all(r[k]==d[k] for k in ['environment','architecture','seed']) and r['generation']==g['generation'])
        assert log['best']==g['bestValidDistance'] and log['medianValid']==g['offspringMedianValid'] and log['valid']==g['validOffspring'] and log['selected']==g['selectedIndex']
        for o in g['offspring']:
            t=o['trial'];validity='valid' if t['valid'] else 'invalid'
            eating[(d['environment'],d['architecture'],validity)]+=t['food']['absorbedJ']>0
            if d['architecture']=='two-output':
                rows=[e['row'] for e in o['mutation']['changes'] if e['field'] in ['weightsHO','biasesO']]
                both=any(i%2==0 for i in rows) and any(i%2==1 for i in rows)
                mutations['hybridWithBothOutputRoles']+=both;mutations['selectedHybridWithBothOutputRoles']+=both and g['selectedIndex']==o['index']
                seen={mode for j in t['joints'] for mode,count in j['modeSubsteps'].items() if count}
                modes.setdefault(str((d['environment'],validity)),collections.Counter()).update(seen)
    if d['champion']:
        t=d['champion']['training'];elite.setdefault(d['environment']+':'+d['architecture'],[]).append({'seed':d['seed'],'switches':t['switches'],'counts':[j['modeSubsteps'] for j in t['joints']]})
for t in trials:
    for k in maxima:maxima[k]=max(maxima[k],abs(t[k]))
passive=[c['trial'] for d in runs for c in d['controls'] if c['control']=='passive']
dry=[c['trial'] for d in runs for c in d['controls'] if c['control']=='fluid-off']
removed=[{'environment':d['environment'],'architecture':d['architecture'],'seed':d['seed'],'champion':bool(d['champion']),'foodOnDistance':d['champion']['training']['distance'] if d['champion'] else None,'foodOnIntakeJ':d['champion']['training']['food']['absorbedJ'] if d['champion'] else None,'trial':c['trial']} for d in runs for c in d['controls'] if c['control']=='food-removed']
extra={'mutations':mutations,'hybridCandidateModes':modes,'championModes':elite,'offspringEating':{str(k):v for k,v in eating.items()},'maxima':maxima,'minimumReserveJ':min(t['remainingJ'] for t in trials),'maxAge':max(t['age'] for t in trials),'passive':{'valid':sum(t['valid'] for t in passive),'zeroMotor':all(t['motorJ']==0 for t in passive),'maxDistance':max(t['distance'] for t in passive)},'fluidOff':{'valid':sum(t['valid'] for t in dry),'maxDistance':max(t['distance'] for t in dry),'maxValidDistance':max(t['distance'] for t in dry if t['valid'])},'foodRemoved':removed,'allUniqueRows':len(trials)}
assert len(trials)==5445
(p/'neural-food-v1-diagnostics.json').write_text(json.dumps(extra,indent=2)+'\n')
print('All324 generation summaries match original runner log; 5445 unique rows aggregated.')
