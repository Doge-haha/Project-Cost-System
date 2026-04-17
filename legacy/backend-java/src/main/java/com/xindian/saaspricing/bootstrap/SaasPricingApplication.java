package com.xindian.saaspricing.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.xindian.saaspricing")
public class SaasPricingApplication {

    public static void main(String[] args) {
        SpringApplication.run(SaasPricingApplication.class, args);
    }
}

