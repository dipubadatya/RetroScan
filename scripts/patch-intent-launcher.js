const fs = require('fs');
const path = require('path');

const gradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-intent-launcher',
  'android',
  'build.gradle'
);

if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  if (content.includes('compile fileTree') || content.includes('compile "com.android.support')) {
    content = content.replace(/compile\s+fileTree/g, 'implementation fileTree');
    content = content.replace(/compile\s+"com\.android\.support:appcompat-v7:\+"/g, 'implementation "androidx.appcompat:appcompat:1.6.1"');
    content = content.replace(/compile\s+"com\.facebook\.react:react-native:\+"/g, 'implementation "com.facebook.react:react-android"');
    fs.writeFileSync(gradlePath, content, 'utf8');
  }
}

const modulePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-intent-launcher',
  'android',
  'src',
  'main',
  'java',
  'com',
  'poberwong',
  'launcher',
  'IntentLauncherModule.java'
);

if (fs.existsSync(modulePath)) {
  let moduleContent = fs.readFileSync(modulePath, 'utf8');
  if (!moduleContent.includes('intent.setPackage(params.getString(ATTR_PACKAGE_NAME));')) {
    moduleContent = moduleContent.replace(
      'intent.setComponent(cn);\n        }',
      'intent.setComponent(cn);\n        }\n        if (params.hasKey(ATTR_PACKAGE_NAME)) {\n            intent.setPackage(params.getString(ATTR_PACKAGE_NAME));\n        }'
    );
  }
  // Replace startActivityForResult so promise resolves immediately without waiting for activity exit
  moduleContent = moduleContent.replace(
    'currentActivity.startActivityForResult(intent, REQUEST_CODE, null);',
    'currentActivity.startActivity(intent);\n                promise.resolve(Arguments.createMap());'
  );
  moduleContent = moduleContent.replace(
    'getReactApplicationContext().startActivityForResult(intent, REQUEST_CODE, null); // 暂时使用当前应用的任务栈',
    'intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);\n        Activity currentActivity = getCurrentActivity();\n        if (currentActivity != null) {\n            currentActivity.startActivity(intent);\n        } else {\n            getReactApplicationContext().startActivity(intent);\n        }\n        promise.resolve(Arguments.createMap());'
  );
  fs.writeFileSync(modulePath, moduleContent, 'utf8');
  console.log('IntentLauncherModule patched successfully.');
}
