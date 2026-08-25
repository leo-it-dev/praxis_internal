import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    standalone: true,
    selector: 'app-colored-svg',
    templateUrl: './colored-svg.component.html',
    styleUrl: "./colored-svg.component.scss"
})
export class ColoredSvgComponent implements OnInit {

    @Input({ required: true })
    public svgSrc = "";

    constructor(private elementRef: ElementRef, private domSan: DomSanitizer) {
    }

    ngOnInit(): void {
        if (this.elementRef.nativeElement.hasAttribute('col')) {
            const col = this.elementRef.nativeElement.getAttribute('col');
            this.elementRef.nativeElement.style.setProperty('--color', col);
        } else {
            this.elementRef.nativeElement.style.setProperty('--color', "var(--primaryLight)");
        }
    }
}