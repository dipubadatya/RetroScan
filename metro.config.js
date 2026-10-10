const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  transformer: {
    babelTransformerPath: require.resolve(
      'react-native-qrcode-svg/textEncodingTransformation'
    ),
  },
};

module.exports = mergeConfig(defaultConfig, config);
