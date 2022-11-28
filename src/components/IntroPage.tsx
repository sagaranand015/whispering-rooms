import { Button, ButtonGroup, Image, Modal } from "react-bootstrap";

export function IntroPage() {
    return (
        <div className="banner" >
            <div className="container">
                <h1 className="font-weight-semibold">Search engine optimisation &<br />Marketing.</h1>
                <h6 className="font-weight-normal text-muted pb-3">Simple is a simple template with a creative design that solves all your marketing and SEO queries.</h6>
                <div>
                    <Button variant="primary" className="btn btn-opacity-light mr-1">Get started</Button>
                </div>
                <img src="images/Group171.svg" alt="" className="img-fluid" />
            </div>
        </div>
    );
}