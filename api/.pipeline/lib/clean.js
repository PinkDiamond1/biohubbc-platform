'use strict';
const { OpenShiftClientX } = require('pipeline-cli');
const checkAndClean = require('../utils/checkAndClean');

/**
 * Run OC commands to clean all build and deployment artifacts (pods, imagestreams, builds/deployment configs, etc).
 *
 * @param {*} settings
 */
module.exports = (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const target_phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases.build.namespace }, options));

  for (let phaseKey in phases) {
    if (!phases.hasOwnProperty(phaseKey)) {
      continue;
    }

    if (phaseKey !== target_phase) {
      continue;
    }

    const phaseObj = phases[phaseKey];

    // Get build configs
    let buildConfigs = oc.get('bc', {
      selector: `app=${phaseObj.instance},env-id=${phaseObj.changeId},!shared,github-repo=${oc.git.repository},github-owner=${oc.git.owner}`,
      namespace: phaseObj.namespace
    });

    // Clean build configs
    buildConfigs.forEach((buildConfig) => {
      if (buildConfig.spec.output.to.kind == 'ImageStreamTag') {
        oc.delete([`ImageStreamTag/${buildConfig.spec.output.to.name}`], {
          'ignore-not-found': 'true',
          wait: 'true',
          namespace: phaseObj.namespace
        });
      }
    });

    // get deployment configs
    let deploymentConfigs = oc.get('dc', {
      selector: `app=${phaseObj.instance},env-id=${phaseObj.changeId},env-name=${phaseKey},!shared,github-repo=${oc.git.repository},github-owner=${oc.git.owner}`,
      namespace: phaseObj.namespace
    });

    // Clean deployment configs
    deploymentConfigs.forEach((deploymentConfig) => {
      deploymentConfig.spec.triggers.forEach((trigger) => {
        if (trigger.type == 'ImageChange' && trigger.imageChangeParams.from.kind == 'ImageStreamTag') {
          oc.delete([`ImageStreamTag/${trigger.imageChangeParams.from.name}`], {
            'ignore-not-found': 'true',
            wait: 'true',
            namespace: phaseObj.namespace
          });
        }
      });
    });

    // Extra cleaning for any disposable 'build' items (database migration/seeding pods, test pods, etc)
    // This should include anything that is only run/used once, and can be deleted afterwards.
    if (phaseKey !== 'build') {
      const newOC = new OpenShiftClientX(Object.assign({ namespace: phases[phaseKey].namespace }, options));
      const setupPod = `${phases[phaseKey].name}${phases[phaseKey].suffix}-setup`;
      // const testPod = `${phases[phaseKey].name}${phases[phaseKey].suffix}-test`;
      checkAndClean(`pod/${setupPod}`, newOC);
      // checkAndClean(`pod/${testPod}`, newOC);
    }

    oc.raw('delete', ['all'], {
      selector: `app=${phaseObj.instance},env-id=${phaseObj.changeId},!shared,github-repo=${oc.git.repository},github-owner=${oc.git.owner}`,
      wait: 'true',
      namespace: phaseObj.namespace
    });

    oc.raw('delete', ['all,pvc,secrets,Secrets,secret,configmap,endpoints,Endpoints'], {
      selector: `app=${phaseObj.instance},env-id=${phaseObj.changeId},!shared,github-repo=${oc.git.repository},github-owner=${oc.git.owner}`,
      wait: 'true',
      namespace: phaseObj.namespace
    });
  }
};
