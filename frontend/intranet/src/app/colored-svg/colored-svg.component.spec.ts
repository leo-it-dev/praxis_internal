import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColoredSvgComponent } from './colored-svg.component';

describe('ColoredSvgComponent', () => {
  let component: ColoredSvgComponent;
  let fixture: ComponentFixture<ColoredSvgComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColoredSvgComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ColoredSvgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
