declare module 'gherkin-parse' {
  function convertFeatureFileToJSON(filePath: string): any;
  
  const gherkinParse: {
    convertFeatureFileToJSON: typeof convertFeatureFileToJSON;
    // Keep convertFeatureToJSON commented out since it may not be implemented
    // convertFeatureToJSON?: (featureText: string) => any;
  };
  
  export default gherkinParse;
}

