#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DevicePerformance, NSObject)

RCT_EXTERN_METHOD(getDeviceSpecs:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runBenchmark:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPerformanceScore:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end