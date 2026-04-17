import org.gradle.api.tasks.testing.Test

plugins {
    base
}

allprojects {
    group = "com.xindian"
    version = "0.1.0-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
    }
}
