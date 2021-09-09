export function colorAdjustment(src){
    src.push("uniform vec4 colorParams;");
    src.push("vec4 brightnessSaturationAndConstrast(vec4 color) {");
    src.push("float brightness = colorParams.r;");
    src.push("float saturation = colorParams.g;");
    src.push("float contrast = colorParams.b;");
    src.push("vec3 finalColor = color.rgb * brightness;");
    src.push("float luminance = 0.2125 * color.r + 0.7154 * color.g + 0.0721 * color.b;");
    src.push("vec3 luminanceColor = vec3(luminance);");
    src.push("finalColor = mix(luminanceColor,finalColor,saturation);");
    src.push("vec3 avgColor = vec3(0.5);");
    src.push("finalColor = clamp(mix(avgColor,finalColor,contrast),0.0,1.0);");
    src.push("return vec4(finalColor,color.a);");
    src.push("}");
}